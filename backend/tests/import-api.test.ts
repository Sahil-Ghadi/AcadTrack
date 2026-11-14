/**
 * Integration tests for CSV Import APIs:
 *   - POST /api/import/preview
 *   - POST /api/import/execute
 *
 * Run with server started:
 *   npx tsx tests/import-api.test.ts
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

async function getToken(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Password@123" }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email} with status ${res.status}`);
  }
  const body = await res.json();
  return body.token;
}

function createCsvFormData(
  csvContent: string,
  fileName: string,
  fields: Record<string, string>,
): FormData {
  const formData = new FormData();
  const blob = new Blob([csvContent], { type: "text/csv" });
  formData.append("file", blob, fileName);
  for (const [key, val] of Object.entries(fields)) {
    formData.append(key, val);
  }
  return formData;
}

async function run() {
  console.log("\n=== Step 8: Dynamic CSV Import API Tests ===\n");

  let adminToken = "";
  let hodToken = "";

  try {
    adminToken = await getToken("admin@acadtrack.test");
    hodToken = await getToken("hod.co@acadtrack.test");
  } catch (e: any) {
    console.log(`Could not connect to API server at ${BASE}: ${e.message}`);
    console.log("Ensure the server is running on port 5000 and PostgreSQL is running to execute integration tests.");
    process.exit(1);
  }

  // 1. Preview student CSV with alternative headers
  await test("POST /import/preview student alternative headers (PRN, Candidate, Mail, Div)", async () => {
    const csv = `PRN,Candidate Name,Mail,Division,Admission Year\nTEST-S1,John Doe,test.s1@test.com,A,2024\nTEST-S2,Jane Doe,test.s2@test.com,A,2024`;
    const formData = createCsvFormData(csv, "students_alt.csv", {
      entity_type: "student",
    });

    const res = await fetch(`${BASE}/api/import/preview`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.suggestedMappings["PRN"] === "roll_no", "Mapped PRN -> roll_no");
    assert(body.suggestedMappings["Candidate Name"] === "full_name", "Mapped Candidate Name -> full_name");
    assert(body.suggestedMappings["Mail"] === "email", "Mapped Mail -> email");
    assert(body.suggestedMappings["Division"] === "section", "Mapped Division -> section");
    assert(body.totalRows === 2, `Expected 2 rows, got ${body.totalRows}`);
    assert(body.validRowCount === 2, `Expected 2 valid rows, got ${body.validRowCount}`);
  });

  // 2. Duplicate detection within uploaded file
  await test("POST /import/preview detects duplicate roll numbers in file", async () => {
    const csv = `Roll No,Full Name,Email,Section,Admission Year\nROLL-DUP1,Alice,alice1@test.com,A,2024\nROLL-DUP1,Alice Two,alice2@test.com,A,2024`;
    const formData = createCsvFormData(csv, "dup_roll.csv", {
      entity_type: "student",
    });

    const res = await fetch(`${BASE}/api/import/preview`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.invalidRowCount >= 1, `Expected at least 1 invalid row, got ${body.invalidRowCount}`);
    const hasDupError = body.errors.some((e: any) => e.error.toLowerCase().includes("duplicate roll number"));
    assert(hasDupError, "Expected duplicate roll number error");
  });

  // 3. Existing database roll number detection
  await test("POST /import/preview detects existing roll number in DB (24B-CO-049)", async () => {
    const csv = `Roll No,Full Name,Email,Section,Admission Year\n24B-CO-049,Sahil Clone,unique.clone@test.com,A,2024`;
    const formData = createCsvFormData(csv, "existing_roll.csv", {
      entity_type: "student",
    });

    const res = await fetch(`${BASE}/api/import/preview`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.invalidRowCount === 1, `Expected invalid row for existing roll no, got ${body.invalidRowCount}`);
    const hasExistingError = body.errors.some((e: any) => e.error.toLowerCase().includes("already exists"));
    assert(hasExistingError, "Expected 'already exists' error");
  });

  // 4. Invalid section error
  await test("POST /import/preview flags non-existent section", async () => {
    const csv = `Roll No,Full Name,Email,Section,Admission Year\nTEST-SEC-ERR,Bob,bob@test.com,NonExistentSectionZ,2024`;
    const formData = createCsvFormData(csv, "invalid_sec.csv", {
      entity_type: "student",
    });

    const res = await fetch(`${BASE}/api/import/preview`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.invalidRowCount === 1, "Row with invalid section flagged");
    const hasSecError = body.errors.some((e: any) => e.error.toLowerCase().includes("section"));
    assert(hasSecError, "Expected section error");
  });

  // 5. Successful student import with password Acad@<RollNo>
  const uniqueRoll = `ST-${Date.now().toString().slice(-6)}`;
  const uniqueEmail = `test.student.${Date.now()}@acadtrack.test`;

  await test("POST /import/execute imports student and sets password Acad@<RollNo>", async () => {
    const csv = `Roll No,Full Name,Email,Section,Admission Year\n${uniqueRoll},Test Importer,${uniqueEmail},A,2024`;
    const mappings = {
      "Roll No": "roll_no",
      "Full Name": "full_name",
      "Email": "email",
      "Section": "section",
      "Admission Year": "admission_year",
    };

    const formData = createCsvFormData(csv, "exec_student.csv", {
      entity_type: "student",
      mappings: JSON.stringify(mappings),
    });

    const res = await fetch(`${BASE}/api/import/execute`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.importedCount === 1, `Expected 1 imported, got ${body.importedCount}`);

    // Verify imported student can log in with Acad@<RollNo>
    const expectedPassword = `Acad@${uniqueRoll}`;
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: uniqueEmail, password: expectedPassword }),
    });
    assert(loginRes.status === 200, `Imported student failed to log in with ${expectedPassword}: ${loginRes.status}`);
  });

  // 6. Faculty import with password Staff@<EmployeeCode>
  const uniqueEmpCode = `FAC-${Date.now().toString().slice(-5)}`;
  const uniqueFacEmail = `test.faculty.${Date.now()}@acadtrack.test`;

  await test("POST /import/execute imports faculty and sets password Staff@<EmployeeCode>", async () => {
    const csv = `Employee Code,Full Name,Email,Department,Designation\n${uniqueEmpCode},Dr. Import Test,${uniqueFacEmail},CO,Assistant Professor`;
    const mappings = {
      "Employee Code": "employee_code",
      "Full Name": "full_name",
      "Email": "email",
      "Department": "department",
      "Designation": "designation",
    };

    const formData = createCsvFormData(csv, "exec_faculty.csv", {
      entity_type: "faculty",
      mappings: JSON.stringify(mappings),
    });

    const res = await fetch(`${BASE}/api/import/execute`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });

    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const body = await res.json();
    assert(body.importedCount === 1, `Expected 1 imported, got ${body.importedCount}`);

    // Verify imported faculty can log in with Staff@<EmployeeCode>
    const expectedPassword = `Staff@${uniqueEmpCode}`;
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: uniqueFacEmail, password: expectedPassword }),
    });
    assert(loginRes.status === 200, `Imported faculty failed to log in with ${expectedPassword}: ${loginRes.status}`);
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

