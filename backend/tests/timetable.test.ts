/**
 * Step 4 tests: Timetable slots, clash prevention (409), lecture sessions & cancel.
 * Run with server started: npx tsx tests/timetable.test.ts
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
  console.log("\n=== Step 4 Timetable Tests ===\n");

  const adminToken = await getToken("admin@acadtrack.test");
  const hodToken = await getToken("hod.co@acadtrack.test");
  const facultyToken = await getToken("faculty1@acadtrack.test");
  const studentToken = await getToken("sahil@acadtrack.test");

  // 1. Unauthenticated -> 401
  await test("GET /slots no token -> 401", async () => {
    const res = await fetch(`${BASE}/api/timetable/slots`);
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // 2. Student cannot create slot -> 403
  await test("POST /slots student -> 403", async () => {
    const res = await fetch(`${BASE}/api/timetable/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        subject_assignment_id: 1,
        day_of_week: 1,
        period_no: 5,
        start_time: "14:00",
        end_time: "15:00",
        room: "R204",
      }),
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // 3. List existing slots (seed has 8 slots)
  let slots: any[] = [];
  await test("GET /slots admin -> 200 with 8 slots", async () => {
    const res = await fetch(`${BASE}/api/timetable/slots`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    slots = await res.json();
    assert(slots.length >= 8, `Expected >= 8 slots, got ${slots.length}`);
  });

  // 4. Room clash test:
  // In seed: CO501 has slot on day 1 (Monday), period 1, in room 'R204'.
  // Trying to schedule another assignment in R204 on day 1, period 1 must trigger 409 (room clash).
  await test("POST /slots room clash -> 409", async () => {
    const assignRes = await fetch(`${BASE}/api/academic/assignments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const assignments = await assignRes.json();
    // Choose CO502 (taught by faculty2)
    const co502 = assignments.find((a: any) => a.subject_code === "CO502");

    const res = await fetch(`${BASE}/api/timetable/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        subject_assignment_id: co502.id,
        day_of_week: 1, // Monday
        period_no: 1,   // Period 1 (already taken by CO501 in R204)
        start_time: "09:00",
        end_time: "10:00",
        room: "R204",   // Same room!
      }),
    });
    assert(res.status === 409, `Expected 409 on room clash, got ${res.status}`);
  });

  // 5. Faculty clash test:
  // Faculty 1 (Dr. Meera Kulkarni) teaches CO501 (Monday period 1) and CO5E1.
  // Trying to schedule CO5E1 for Faculty 1 on day 1 period 1 in a DIFFERENT room (e.g. R999) must trigger 409 (faculty clash).
  await test("POST /slots faculty clash -> 409", async () => {
    const assignRes = await fetch(`${BASE}/api/academic/assignments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const assignments = await assignRes.json();
    const electiveAssign = assignments.find((a: any) => a.subject_code === "CO5E1");

    const res = await fetch(`${BASE}/api/timetable/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        subject_assignment_id: electiveAssign.id,
        day_of_week: 1, // Monday
        period_no: 1,   // Period 1 (Faculty 1 already has CO501!)
        start_time: "09:00",
        end_time: "10:00",
        room: "R999",   // Different room, but same faculty at same time!
      }),
    });
    assert(res.status === 409, `Expected 409 on faculty clash, got ${res.status}`);
  });

  // 6. Non-clashing slot creation -> 201
  let createdSlotId = 0;
  await test("POST /slots non-clashing -> 201", async () => {
    const assignRes = await fetch(`${BASE}/api/academic/assignments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const assignments = await assignRes.json();
    const co501 = assignments.find((a: any) => a.subject_code === "CO501");

    const res = await fetch(`${BASE}/api/timetable/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        subject_assignment_id: co501.id,
        day_of_week: 6, // Saturday
        period_no: 4,
        start_time: "12:00",
        end_time: "13:00",
        room: "R204",
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const body = await res.json();
    createdSlotId = body.id;
  });

  // 7. Generate lecture sessions for that slot
  await test("POST /sessions/generate -> 201", async () => {
    const res = await fetch(`${BASE}/api/timetable/sessions/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        start_date: "2026-11-01",
        end_date: "2026-11-28",
        slot_id: createdSlotId,
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const body = await res.json();
    assert(body.count >= 4, `Expected at least 4 Saturday sessions in November, got ${body.count}`);
  });

  // 8. Cancel an open lecture session
  let targetSessionId = 0;
  await test("PATCH /sessions/:id/cancel -> 200", async () => {
    // Find an open (non-locked) session
    const listRes = await fetch(`${BASE}/api/timetable/sessions?is_locked=false&status=scheduled`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const sessions = await listRes.json();
    assert(sessions.length > 0, "No scheduled sessions found");
    targetSessionId = sessions[0].id;

    const cancelRes = await fetch(`${BASE}/api/timetable/sessions/${targetSessionId}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "cancelled" }),
    });
    assert(cancelRes.status === 200, `Expected 200, got ${cancelRes.status}`);
    const body = await cancelRes.json();
    assert(body.status === "cancelled", `Expected cancelled, got ${body.status}`);
  });

  // 9. Modifying/cancelling an already LOCKED lecture -> trigger rejects with 409
  await test("PATCH /sessions/:id/cancel on locked lecture -> trigger rejects with 409", async () => {
    // Find a locked lecture session
    const listRes = await fetch(`${BASE}/api/timetable/sessions?is_locked=true`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const lockedSessions = await listRes.json();
    assert(lockedSessions.length > 0, "No locked sessions found");
    const lockedId = lockedSessions[0].id;

    const res = await fetch(`${BASE}/api/timetable/sessions/${lockedId}/cancel`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "cancelled" }),
    });
    assert(res.status === 409, `Expected 409 from locked trigger, got ${res.status}`);
    const body = await res.json();
    assert(body.message.toLowerCase().includes("locked"), `Unexpected message: ${body.message}`);
  });

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${passed}/${results.length} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e); process.exit(1); });
