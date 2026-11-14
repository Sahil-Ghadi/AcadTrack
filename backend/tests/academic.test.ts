/**
 * Step 3 tests: Users/students/faculty, subjects, assignments, electives.
 * Run with server started: npx tsx tests/academic.test.ts
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
  console.log("\n=== Step 3 Academic Tests ===\n");

  const adminToken = await getToken("admin@acadtrack.test");
  const hodToken = await getToken("hod.co@acadtrack.test");
  const facultyToken = await getToken("faculty1@acadtrack.test");
  const studentToken = await getToken("sahil@acadtrack.test");

  // 1. Unauthenticated -> 401
  await test("GET /students no token -> 401", async () => {
    const res = await fetch(`${BASE}/api/academic/students`);
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // 2. Student cannot list faculty -> 403
  await test("GET /faculty student -> 403", async () => {
    const res = await fetch(`${BASE}/api/academic/faculty`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // 3. List students (seed has 6)
  await test("GET /students admin -> 200 with 6+ students", async () => {
    const res = await fetch(`${BASE}/api/academic/students`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.length >= 6, `Expected >=6 students, got ${body.length}`);
    assert(body[0].roll_no !== undefined, "Expected roll_no in student object");
  });

  // 4. List faculty (seed has 3)
  await test("GET /faculty admin -> 200 with 3+ faculty", async () => {
    const res = await fetch(`${BASE}/api/academic/faculty`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.length >= 3, `Expected >=3 faculty, got ${body.length}`);
  });

  // 5. Create new student & verify login
  const testStudentEmail = `test.student.${Date.now()}@acadtrack.test`;
  let newStudentUserId = 0;
  let newStudentId = 0;

  await test("POST /students admin -> creates student with hashed password", async () => {
    // get section A id
    const secRes = await fetch(`${BASE}/api/institution/sections`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const sections = await secRes.json();
    const sectionA = sections.find((s: any) => s.name === "A");

    const res = await fetch(`${BASE}/api/academic/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        email: testStudentEmail,
        password: "Password@123",
        section_id: sectionA.id,
        roll_no: `ROLL-${Date.now()}`,
        full_name: "Test New Student",
        admission_year: 2024,
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const body = await res.json();
    assert(body.user.role === "student", "Expected student role");
    newStudentUserId = body.user.id;
    newStudentId = body.id;

    // Verify student can log in
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testStudentEmail, password: "Password@123" }),
    });
    assert(loginRes.status === 200, `Login failed for created student: ${loginRes.status}`);
  });

  // 6. Deactivate student -> login fails (401)
  await test("PATCH /users/:id/status (deactivate) -> login blocked", async () => {
    const deactRes = await fetch(`${BASE}/api/academic/users/${newStudentUserId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ is_active: false }),
    });
    assert(deactRes.status === 200, `Expected 200, got ${deactRes.status}`);

    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testStudentEmail, password: "Password@123" }),
    });
    assert(loginRes.status === 401, `Expected 401 for deactivated user, got ${loginRes.status}`);
  });

  // 7. Reactivate student -> login succeeds
  await test("PATCH /users/:id/status (reactivate) -> login allowed", async () => {
    const reactRes = await fetch(`${BASE}/api/academic/users/${newStudentUserId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ is_active: true }),
    });
    assert(reactRes.status === 200, `Expected 200, got ${reactRes.status}`);

    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testStudentEmail, password: "Password@123" }),
    });
    assert(loginRes.status === 200, `Expected 200 after reactivation, got ${loginRes.status}`);
  });

  // 8. Create subject
  let newSubjectId = 0;
  await test("POST /subjects admin -> creates subject", async () => {
    const deptRes = await fetch(`${BASE}/api/institution/departments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const depts = await deptRes.json();
    const coDept = depts.find((d: any) => d.code === "CO");

    const res = await fetch(`${BASE}/api/academic/subjects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        department_id: coDept.id,
        code: `CO-T${Date.now().toString().slice(-4)}`,
        name: "Software Engineering",
        subject_type: "theory",
        semester: 5,
        is_elective: false,
        max_it_marks: 20,
        max_assignment_marks: 10,
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const body = await res.json();
    newSubjectId = body.id;
  });

  // 9. Elective guard: Attempting to enroll student into NON-ELECTIVE subject -> trigger throws exception (422)
  await test("POST /electives on non-elective subject -> DB trigger rejects with 422", async () => {
    const termRes = await fetch(`${BASE}/api/institution/academic-terms/current`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const currentTerm = await termRes.json();

    const res = await fetch(`${BASE}/api/academic/electives`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        student_id: newStudentId,
        subject_id: newSubjectId, // is_elective = false
        term_id: currentTerm.id,
      }),
    });
    assert(res.status === 422, `Expected 422 from elective trigger, got ${res.status}`);
    const body = await res.json();
    assert(body.message.toLowerCase().includes("not an elective"), `Unexpected message: ${body.message}`);
  });

  // 10. Elective guard: Enrolling in true elective subject -> 201
  await test("POST /electives on real elective subject -> 201", async () => {
    const subjRes = await fetch(`${BASE}/api/academic/subjects`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const subjects = await subjRes.json();
    const electiveSubj = subjects.find((s: any) => s.code === "CO5E1");

    const termRes = await fetch(`${BASE}/api/institution/academic-terms/current`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const currentTerm = await termRes.json();

    const res = await fetch(`${BASE}/api/academic/electives`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        student_id: newStudentId,
        subject_id: electiveSubj.id,
        term_id: currentTerm.id,
      }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
  });

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${passed}/${results.length} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e); process.exit(1); });
