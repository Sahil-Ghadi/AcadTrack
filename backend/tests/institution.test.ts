/**
 * Step 2 tests: Institution setup APIs.
 * Run with server started: npx tsx tests/institution.test.ts
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
  console.log("\n=== Step 2 Institution Tests ===\n");

  const adminToken = await getToken("admin@acadtrack.test");
  const hodToken = await getToken("hod.co@acadtrack.test");
  const facultyToken = await getToken("faculty1@acadtrack.test");
  const studentToken = await getToken("sahil@acadtrack.test");

  // 1. No token -> 401
  await test("GET /departments no token -> 401", async () => {
    const res = await fetch(`${BASE}/api/institution/departments`);
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // 2. Student -> 403 (not authorized for departments)
  await test("GET /departments student -> 403", async () => {
    const res = await fetch(`${BASE}/api/institution/departments`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // 3. Faculty -> 403 (not authorized for departments)
  await test("GET /departments faculty -> 403", async () => {
    const res = await fetch(`${BASE}/api/institution/departments`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // 4. Admin -> 200
  await test("GET /departments admin -> 200", async () => {
    const res = await fetch(`${BASE}/api/institution/departments`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(Array.isArray(body), "Expected array");
    assert(body.length >= 1, "Expected at least 1 department");
    assert(body[0].code === "CO", `Expected CO, got ${body[0].code}`);
  });

  // 5. HOD -> 200 (dept_admin can read)
  await test("GET /departments hod -> 200", async () => {
    const res = await fetch(`${BASE}/api/institution/departments`, {
      headers: { Authorization: `Bearer ${hodToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // 6. HOD cannot create department (college_admin only)
  await test("POST /departments hod -> 403", async () => {
    const res = await fetch(`${BASE}/api/institution/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${hodToken}` },
      body: JSON.stringify({ name: "Test Dept", code: "TST" }),
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // 7. Admin creates department -> 201
  await test("POST /departments admin -> 201", async () => {
    const res = await fetch(`${BASE}/api/institution/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: "Information Technology", code: "IT" }),
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    const body = await res.json();
    assert(body.code === "IT", `Expected IT, got ${body.code}`);
  });

  // 8. Duplicate department -> 409
  await test("POST /departments duplicate -> 409", async () => {
    const res = await fetch(`${BASE}/api/institution/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: "Computer Engineering Dup", code: "CO" }),
    });
    assert(res.status === 409, `Expected 409, got ${res.status}`);
  });

  // 9. List programs
  await test("GET /programs admin -> 200", async () => {
    const res = await fetch(`${BASE}/api/institution/programs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.length >= 1, "Expected at least 1 program");
  });

  // 10. List batches
  await test("GET /batches admin -> 200", async () => {
    const res = await fetch(`${BASE}/api/institution/batches`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.length >= 1, "Expected at least 1 batch");
  });

  // 11. List sections
  await test("GET /sections admin -> 200", async () => {
    const res = await fetch(`${BASE}/api/institution/sections`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.length >= 2, "Expected at least 2 sections (A, B)");
  });

  // 12. List lab groups
  await test("GET /lab-groups admin -> 200", async () => {
    const res = await fetch(`${BASE}/api/institution/lab-groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.length >= 2, "Expected at least 2 lab groups (A1, A2)");
  });

  // 13. List academic terms
  await test("GET /academic-terms admin -> 200", async () => {
    const res = await fetch(`${BASE}/api/institution/academic-terms`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.length >= 1, "Expected at least 1 term");
  });

  // 14. Get current term
  await test("GET /academic-terms/current -> 200", async () => {
    const res = await fetch(`${BASE}/api/institution/academic-terms/current`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.is_current === true, "Expected is_current=true");
    assert(body.academic_year === "2026-2027", `Expected 2026-2027, got ${body.academic_year}`);
  });

  // 15. Get settings
  await test("GET /settings admin -> 200", async () => {
    const res = await fetch(`${BASE}/api/institution/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(Number(body.attendance_threshold) === 75, `Expected 75, got ${body.attendance_threshold}`);
  });

  // 16. Update settings
  await test("PUT /settings admin -> 200", async () => {
    const res = await fetch(`${BASE}/api/institution/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ attendance_threshold: 80 }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(Number(body.attendance_threshold) === 80, `Expected 80, got ${body.attendance_threshold}`);

    // Reset back to 75
    await fetch(`${BASE}/api/institution/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ attendance_threshold: 75 }),
    });
  });

  // 17. Faculty cannot access settings
  await test("GET /settings faculty -> 403", async () => {
    const res = await fetch(`${BASE}/api/institution/settings`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert(res.status === 403, `Expected 403, got ${res.status}`);
  });

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${passed}/${results.length} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e); process.exit(1); });

