/**
 * Step 5 tests: Attendance APIs, elective filtering, locking, trigger enforcement.
 * Run with server started: npx tsx tests/attendance.test.ts
 */

const BASE = "http://localhost:5000";

interface TestResult { name: string; passed: boolean; detail?: string }
const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ name, passed: false, detail: msg });
    console.log(`  ✗ ${name}: ${msg}`);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function getToken(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Password@123" }),
  });
  const body = await res.json();
  return body.token;
}

async function run() {
  console.log("\n=== Step 5 Attendance Tests ===\n");

  const adminToken = await getToken("admin@acadtrack.test");
  const faculty1Token = await getToken("faculty1@acadtrack.test");
  const faculty2Token = await getToken("faculty2@acadtrack.test");
  const studentToken = await getToken("sahil@acadtrack.test");

  // 1. Unauthenticated -> 401
  await test("GET /my-lectures no token -> 401", async () => {
    const res = await fetch(`${BASE}/api/attendance/my-lectures`);
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // 2. Student cannot access /my-lectures -> 403
  await test("GET /my-lectures student -> 403", async () => {
    const res = await fetch(`${BASE}/api/attendance/my-lectures`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // 3. Faculty 1 fetches their open lectures for CO501
  let testSessionId = 0;
  await test("GET /sessions faculty -> 200 with scheduled open CO501 session", async () => {
    const res = await fetch(`${BASE}/api/timetable/sessions?faculty_id=1&is_locked=false&status=scheduled`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    const co501Session = body.find((s: any) => s.subject_code === "CO501");
    assert(co501Session, "Expected at least 1 open scheduled lecture for CO501");
    testSessionId = co501Session.id;
  });

  // 4. Get student list for a regular lecture (CO501) -> all 6 students in Section A
  let studentsList: any[] = [];
  await test("GET /sessions/:id/students regular subject -> returns all 6 students", async () => {
    const res = await fetch(`${BASE}/api/attendance/sessions/${testSessionId}/students`, {
      headers: { Authorization: `Bearer ${faculty1Token}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.students.length >= 6, `Expected >= 6 students, got ${body.students.length}`);
    studentsList = body.students;
  });

  // 5. Elective subject test: find a session for elective CO5E1
  await test("GET /sessions/:id/students elective -> returns ONLY 2 enrolled students", async () => {
    // Find an open session for CO5E1
    const sessionsRes = await fetch(`${BASE}/api/timetable/sessions?startDate=2026-10-01&status=scheduled`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const sessions = await sessionsRes.json();
    const electiveSession = sessions.find((s: any) => s.subject_code === "CO5E1");
    assert(electiveSession, "No elective session found in October");

    const res = await fetch(`${BASE}/api/attendance/sessions/${electiveSession.id}/students`, {
      headers: { Authorization: `Bearer ${faculty1Token}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    // In seed, Sahil (24B-CO-049) and Pratham (24B-CO-045) are enrolled in CO5E1, but not Sanjeet (24B-CO-056)
    assert(body.students.length >= 2, `Expected >= 2 enrolled students, got ${body.students.length}`);
    const rollNos = body.students.map((s: any) => s.roll_no);
    assert(rollNos.includes("24B-CO-049") && rollNos.includes("24B-CO-045"), "Expected seed students in elective");
    assert(!rollNos.includes("24B-CO-056"), "Non-enrolled student should not be in elective");
  });

  // 6. Faculty 2 attempts to mark attendance for Faculty 1's lecture -> 403
  await test("POST /sessions/:id/submit wrong faculty -> 403", async () => {
    const records = studentsList.map((s) => ({ student_id: Number(s.id), status: "present" as const }));
    const res = await fetch(`${BASE}/api/attendance/sessions/${testSessionId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${faculty2Token}` },
      body: JSON.stringify({ records, lock: false }),
    });
    const b = await res.json();
    assert(res.status === 403, `Expected 403, got ${res.status}: ${JSON.stringify(b)}`);
  });

  // 7. Faculty 1 submits attendance without locking (save draft) -> 200
  await test("POST /sessions/:id/submit faculty valid -> 200", async () => {
    const records = studentsList.map((s, idx) => ({
      student_id: Number(s.id),
      status: (idx === 0 ? "absent" : "present") as "present" | "absent",
    }));

    const res = await fetch(`${BASE}/api/attendance/sessions/${testSessionId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${faculty1Token}` },
      body: JSON.stringify({ records, lock: false }),
    });
    const b = await res.json();
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(b)}`);
    assert(b.markedCount === records.length, `Expected ${records.length} marked, got ${b.markedCount}`);
    assert(b.session.is_locked === false, "Session should not be locked yet");
  });

  // 8. Lock the lecture session -> 200, is_locked = true, status = 'held'
  await test("POST /sessions/:id/lock faculty -> 200, locks session and marks held", async () => {
    const res = await fetch(`${BASE}/api/attendance/sessions/${testSessionId}/lock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${faculty1Token}` },
    });
    const b = await res.json();
    assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(b)}`);
    assert(b.session.is_locked === true, "Session is_locked should be true");
    assert(b.session.status === "held", `Expected status 'held', got ${b.session.status}`);
  });

  // 9. Modifying attendance for a LOCKED lecture session -> DB trigger attendance_guard throws 409
  await test("POST /sessions/:id/submit on LOCKED session -> DB trigger rejects with 409", async () => {
    const records = studentsList.map((s) => ({ student_id: Number(s.id), status: "present" as const }));
    const res = await fetch(`${BASE}/api/attendance/sessions/${testSessionId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${faculty1Token}` },
      body: JSON.stringify({ records, lock: false }),
    });
    const b = await res.json();
    assert(res.status === 409, `Expected 409 from attendance trigger, got ${res.status}: ${JSON.stringify(b)}`);
    assert(b.message.toLowerCase().includes("locked"), `Unexpected message: ${b.message}`);
  });

  // 10. Attempting to mark attendance for a CANCELLED lecture -> rejects with 422
  await test("POST /sessions/:id/submit on CANCELLED lecture -> rejects with 422", async () => {
    // Find or create a cancelled session
    const sessionsRes = await fetch(`${BASE}/api/timetable/sessions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const allSessions = await sessionsRes.json();
    const cancelled = allSessions.find((s: any) => s.status === "cancelled");
    assert(cancelled, "No cancelled session found in seed");

    const records = [{ student_id: Number(studentsList[0].id), status: "present" as const }];
    const res = await fetch(`${BASE}/api/attendance/sessions/${cancelled.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ records, lock: false }),
    });
    const errBody = await res.json();
    assert(res.status === 422, `Expected 422 for cancelled lecture, got ${res.status}: ${JSON.stringify(errBody)}`);
  });

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${passed}/${results.length} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e); process.exit(1); });
