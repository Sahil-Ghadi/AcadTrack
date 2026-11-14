/**
 * Step 6 tests: Marks entry, max marks validation (trigger enforced), wrong faculty 403.
 * Run with server started: npx tsx tests/marks.test.ts
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
  console.log("\n=== Step 6 Marks Tests ===\n");

  const adminToken = await getToken("admin@acadtrack.test");
  const faculty1Token = await getToken("faculty1@acadtrack.test");
  const faculty2Token = await getToken("faculty2@acadtrack.test");
  const studentToken = await getToken("sahil@acadtrack.test");

  // 1. Unauthenticated -> 401
  await test("GET /assignments/:id no token -> 401", async () => {
    const res = await fetch(`${BASE}/api/marks/assignments/1`);
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // 2. Student cannot enter marks -> 403
  await test("POST /submit student -> 403", async () => {
    const res = await fetch(`${BASE}/api/marks/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        subject_assignment_id: 1,
        marks: [{ student_id: 1, component: "IT1", marks_obtained: 18 }],
      }),
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // 3. Faculty 1 fetches marks for CO501
  let co501Assignment: any;
  let studentsData: any[] = [];
  await test("GET /assignments/:id faculty -> 200 with student marks", async () => {
    // Find CO501 assignment
    const assignRes = await fetch(`${BASE}/api/academic/assignments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const assignments = await assignRes.json();
    co501Assignment = assignments.find((a: any) => a.subject_code === "CO501");
    assert(co501Assignment, "CO501 assignment not found");

    const res = await fetch(`${BASE}/api/marks/assignments/${co501Assignment.id}`, {
      headers: { Authorization: `Bearer ${faculty1Token}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.students.length >= 6, `Expected >= 6 students, got ${body.students.length}`);
    studentsData = body.students;

    // In seed: IT1, IT2, ASSIGNMENT are entered; IT3 is pending (null)
    const firstStudent = studentsData[0];
    assert(firstStudent.it1 !== null, "Expected IT1 marks to be entered from seed");
    assert(firstStudent.it2 !== null, "Expected IT2 marks to be entered from seed");
    assert(firstStudent.assignment !== null, "Expected ASSIGNMENT marks to be entered from seed");
  });

  // 4. Faculty 2 attempts to enter marks for Faculty 1's subject -> 403
  await test("POST /submit wrong faculty -> 403", async () => {
    const res = await fetch(`${BASE}/api/marks/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${faculty2Token}` },
      body: JSON.stringify({
        subject_assignment_id: co501Assignment.id,
        marks: [{ student_id: Number(studentsData[0].student_id), component: "IT3", marks_obtained: 18 }],
      }),
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // 5. Max mark violation: IT mark > max_it_marks (20) -> DB trigger trg_marks_guard rejects with 422
  await test("POST /submit IT3 marks > 20 -> DB trigger rejects with 422", async () => {
    const res = await fetch(`${BASE}/api/marks/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${faculty1Token}` },
      body: JSON.stringify({
        subject_assignment_id: co501Assignment.id,
        marks: [{ student_id: Number(studentsData[0].student_id), component: "IT3", marks_obtained: 25 }],
      }),
    });
    assert(res.status === 422, `Expected 422 for exceeding max mark, got ${res.status}`);
    const body = await res.json();
    assert(body.message.includes("exceed the maximum"), `Unexpected message: ${body.message}`);
  });

  // 6. Max mark violation for ASSIGNMENT: mark > max_assignment_marks (10) -> DB trigger rejects with 422
  await test("POST /submit ASSIGNMENT marks > 10 -> DB trigger rejects with 422", async () => {
    const res = await fetch(`${BASE}/api/marks/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${faculty1Token}` },
      body: JSON.stringify({
        subject_assignment_id: co501Assignment.id,
        marks: [{ student_id: Number(studentsData[0].student_id), component: "ASSIGNMENT", marks_obtained: 15 }],
      }),
    });
    assert(res.status === 422, `Expected 422 for exceeding assignment max mark, got ${res.status}`);
    const body = await res.json();
    assert(body.message.includes("exceed the maximum"), `Unexpected message: ${body.message}`);
  });

  // 7. Valid bulk marks submission for IT3 (all 6 students) -> 200
  await test("POST /submit valid bulk marks -> 200", async () => {
    const marksPayload = studentsData.map((s, idx) => ({
      student_id: Number(s.student_id),
      component: "IT3" as const,
      marks_obtained: 15 + (idx % 5),
    }));

    const res = await fetch(`${BASE}/api/marks/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${faculty1Token}` },
      body: JSON.stringify({
        subject_assignment_id: co501Assignment.id,
        marks: marksPayload,
      }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.savedCount === marksPayload.length, `Expected ${marksPayload.length} saved, got ${body.savedCount}`);
  });

  // 8. Verify IT3 marks are now visible in the assignment marks view
  await test("GET /assignments/:id -> IT3 marks are now populated", async () => {
    const res = await fetch(`${BASE}/api/marks/assignments/${co501Assignment.id}`, {
      headers: { Authorization: `Bearer ${faculty1Token}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    for (const student of body.students) {
      assert(student.it3 !== null, `Expected IT3 marks for ${student.roll_no} to be present`);
    }
  });

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${passed}/${results.length} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e); process.exit(1); });
