/**
 * Step 1 tests: Auth middleware, /me endpoint, error handler.
 * 
 * Run with the server already started:
 *   npx tsx tests/auth.test.ts
 * 
 * Tests:
 *   1. POST /api/auth/login valid creds -> 200 + token
 *   2. POST /api/auth/login wrong password -> 401
 *   3. POST /api/auth/login invalid body -> 400
 *   4. GET /api/auth/me no token -> 401
 *   5. GET /api/auth/me bad token -> 401
 *   6. GET /api/auth/me valid token -> 200 + user object
 */

const BASE = "http://localhost:5000";

interface TestResult {
  name: string;
  passed: boolean;
  detail?: string;
}

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

async function run() {
  console.log("\n=== Step 1 Auth Tests ===\n");

  let validToken = "";

  // 1. Valid login
  await test("POST /login valid creds -> 200", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@acadtrack.test", password: "Password@123" }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.token, "No token in response");
    assert(body.user.role === "college_admin", `Expected college_admin, got ${body.user.role}`);
    validToken = body.token;
  });

  // 2. Wrong password -> 401
  await test("POST /login wrong password -> 401", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@acadtrack.test", password: "WrongPass" }),
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // 3. Invalid body -> 400
  await test("POST /login invalid body -> 400", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  // 4. GET /me no token -> 401
  await test("GET /me no token -> 401", async () => {
    const res = await fetch(`${BASE}/api/auth/me`);
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // 5. GET /me bad token -> 401
  await test("GET /me bad token -> 401", async () => {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: "Bearer bad.token.here" },
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // 6. GET /me valid token -> 200
  await test("GET /me valid token -> 200", async () => {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.user.email === "admin@acadtrack.test", `Unexpected email: ${body.user.email}`);
    assert(body.user.role === "college_admin", `Unexpected role: ${body.user.role}`);
    assert(!body.user.passwordHash, "password_hash leaked!");
  });

  // 7. Test with faculty token
  await test("Faculty login and /me -> correct role", async () => {
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "faculty1@acadtrack.test", password: "Password@123" }),
    });
    assert(loginRes.status === 200, `Login failed: ${loginRes.status}`);
    const { token } = await loginRes.json();

    const meRes = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(meRes.status === 200, `Expected 200, got ${meRes.status}`);
    const body = await meRes.json();
    assert(body.user.role === "faculty", `Expected faculty, got ${body.user.role}`);
  });

  // 8. Test student login
  await test("Student login -> correct role", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "sahil@acadtrack.test", password: "Password@123" }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.user.role === "student", `Expected student, got ${body.user.role}`);
  });

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${passed}/${results.length} passed, ${failed} failed\n`);

  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
