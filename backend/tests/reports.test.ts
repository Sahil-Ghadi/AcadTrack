/**
 * Step 7 tests: Reports, student self-scoping, class stats, below threshold, CSV export.
 * Run with server started: npx tsx tests/reports.test.ts
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
  console.log("\n=== Step 7 Reports Tests ===\n");

  const adminToken = await getToken("admin@acadtrack.test");
  const faculty1Token = await getToken("faculty1@acadtrack.test");
  const studentToken = await getToken("sahil@acadtrack.test");

  // 1. Unauthenticated -> 401
  await test("GET /my-report no token -> 401", async () => {
    const res = await fetch(`${BASE}/api/reports/my-report`);
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // 2. Student accesses own report -> 200 with only own subjects
  let studentRoll = "";
  await test("GET /my-report student -> 200 with subjects, attendance % and marks", async () => {
    const res = await fetch(`${BASE}/api/reports/my-report`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.student.roll_no === "24B-CO-049", `Expected Sahil (24B-CO-049), got ${body.student.roll_no}`);
    studentRoll = body.student.roll_no;
    assert(body.subjects.length >= 3, `Expected at least 3 subjects, got ${body.subjects.length}`);

    // Verify first subject has attendance and marks from views
    const firstSubj = body.subjects[0];
    assert(firstSubj.attendance_pct !== undefined, "Expected attendance_pct");
    assert(firstSubj.is_eligible !== undefined, "Expected is_eligible boolean");
    assert(firstSubj.it1 !== undefined, "Expected it1 marks");
  });

  // 3. Scoping check: Student CANNOT access class assignment report or analytics -> 403
  await test("GET /assignments/:id student -> 403 (students cannot see class lists)", async () => {
    const res = await fetch(`${BASE}/api/reports/assignments/1`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  await test("GET /analytics student -> 403 (students cannot see college analytics)", async () => {
    const res = await fetch(`${BASE}/api/reports/analytics`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // 4. Faculty accesses assignment report -> 200 with all students in the class
  let co501AssignmentId = 0;
  await test("GET /assignments/:id faculty -> 200 with full student attendance and marks", async () => {
    const assignRes = await fetch(`${BASE}/api/academic/assignments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const assignments = await assignRes.json();
    const co501 = assignments.find((a: any) => a.subject_code === "CO501");
    co501AssignmentId = co501.id;

    const res = await fetch(`${BASE}/api/reports/assignments/${co501AssignmentId}`, {
      headers: { Authorization: `Bearer ${faculty1Token}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.students.length >= 6, `Expected >= 6 students, got ${body.students.length}`);
    const s = body.students[0];
    assert(s.attendance_pct !== undefined, "Expected attendance_pct in report");
    assert(s.is_eligible !== undefined, "Expected is_eligible in report");
  });

  // 5. Below threshold filter
  await test("GET /assignments/:id?below_threshold_only=true -> returns only ineligible students", async () => {
    const res = await fetch(`${BASE}/api/reports/assignments/${co501AssignmentId}?below_threshold_only=true`, {
      headers: { Authorization: `Bearer ${faculty1Token}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    for (const s of body.students) {
      assert(s.is_eligible === false, `Expected is_eligible=false, got true for ${s.roll_no}`);
    }
  });

  // 6. Class statistics
  await test("GET /assignments/:id/stats -> 200 with distribution and averages", async () => {
    const res = await fetch(`${BASE}/api/reports/assignments/${co501AssignmentId}/stats`, {
      headers: { Authorization: `Bearer ${faculty1Token}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.totalStudents >= 6, "Expected totalStudents >= 6");
    assert(body.averageAttendancePct !== undefined, "Expected averageAttendancePct");
    assert(body.distribution !== undefined, "Expected distribution object");
    assert(body.marksAverages !== undefined, "Expected marksAverages object");
    assert(body.marksAverages.it1 !== null, "Expected IT1 average");
  });

  // 7. Department/College Analytics
  await test("GET /analytics admin -> 200 with department-wise metrics", async () => {
    const res = await fetch(`${BASE}/api/reports/analytics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.length >= 1, "Expected at least 1 department");
    assert(body[0].department_code === "CO", `Expected CO dept, got ${body[0].department_code}`);
    assert(body[0].total_students !== undefined, "Expected total_students count");
    assert(body[0].avg_attendance_pct !== undefined, "Expected avg_attendance_pct");
  });

  // 8. CSV Export
  await test("GET /assignments/:id?format=csv -> 200 with text/csv content", async () => {
    const res = await fetch(`${BASE}/api/reports/assignments/${co501AssignmentId}?format=csv`, {
      headers: { Authorization: `Bearer ${faculty1Token}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const contentType = res.headers.get("Content-Type");
    assert(contentType?.includes("text/csv") ?? false, `Expected text/csv, got ${contentType}`);
    const text = await res.text();
    assert(text.includes("Roll No,Full Name,Total Lectures"), "CSV header missing");
    assert(text.includes("24B-CO-049"), "Student roll number missing from CSV");
  });

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${passed}/${results.length} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e); process.exit(1); });
