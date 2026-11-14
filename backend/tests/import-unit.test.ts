import { parseCsv, detectDelimiter } from "../src/utils/csv/parser";
import {
  detectHeaderMappings,
  matchHeaderToCanonical,
  getCanonicalFields,
  normalizeHeader,
} from "../src/utils/csv/header-mapper";
import { serializeToCsv } from "../src/utils/csv/csv-serializer";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failedCount++;
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(message);
  }
}

function test(name: string, fn: () => void) {
  try {
    fn();
    passedCount++;
    console.log(`  ✓ PASS: ${name}`);
  } catch {
    // Already logged
  }
}

console.log("\n=======================================================");
console.log("     AcadTrack Shared CSV Engine - Unit Test Suite     ");
console.log("=======================================================\n");

// --- 1. CSV Parser Tests ---
console.log("--- 1. CSV Parser Tests ---");

test("Standard CSV parsing with comma delimiter", () => {
  const csv = "Roll No,Full Name,Email\n24B-CO-001,Alice Smith,alice@test.com\n24B-CO-002,Bob Jones,bob@test.com";
  const result = parseCsv(Buffer.from(csv));
  assert(result.totalRows === 2, `Expected 2 rows, got ${result.totalRows}`);
  assert(result.headers.length === 3, "Expected 3 headers");
  assert(result.rows[0]["Roll No"] === "24B-CO-001", "Expected correct roll no");
  assert(result.rows[1]["Full Name"] === "Bob Jones", "Expected correct name");
});

test("UTF-8 BOM stripping", () => {
  const csv = "\uFEFFPRN,Candidate Name,Mail\n101,John Doe,john@test.com";
  const result = parseCsv(Buffer.from(csv));
  assert(result.headers[0] === "PRN", `Expected header 'PRN' without BOM, got '${result.headers[0]}'`);
  assert(result.rows[0]["PRN"] === "101", "Row data preserved after BOM stripping");
});

test("Semicolon-delimited CSV support", () => {
  const csv = "Emp ID;Teacher Name;Official Email\nEMP201;Prof. Alan;alan@test.com\nEMP202;Prof. Grace;grace@test.com";
  assert(detectDelimiter(csv) === ";", "Expected semicolon detected as delimiter");
  const result = parseCsv(Buffer.from(csv));
  assert(result.totalRows === 2, `Expected 2 rows, got ${result.totalRows}`);
  assert(result.headers[0] === "Emp ID", "Correct headers parsed with semicolon");
  assert(result.rows[0]["Teacher Name"] === "Prof. Alan", "Field correctly parsed with semicolon");
});

test("Quoted values containing commas and whitespace", () => {
  const csv = 'Roll Number,Candidate Name,Email\n"24B-CO-010","Smith, John Jr.",john.smith@test.com';
  const result = parseCsv(Buffer.from(csv));
  assert(result.rows[0]["Candidate Name"] === "Smith, John Jr.", `Expected 'Smith, John Jr.', got '${result.rows[0]["Candidate Name"]}'`);
});

test("Windows CRLF (\\r\\n) and Unix (\\n) line endings", () => {
  const csv = "Code,Name,Email\r\nE1,A,a@t.com\r\nE2,B,b@t.com\r\n";
  const result = parseCsv(Buffer.from(csv));
  assert(result.totalRows === 2, `Expected 2 rows with CRLF, got ${result.totalRows}`);
});

test("Empty rows skipping and whitespace trimming", () => {
  const csv = "Roll No, Name , Email \n\n 101 ,  Alice White  , alice@test.com \n\n";
  const result = parseCsv(Buffer.from(csv));
  assert(result.totalRows === 1, `Expected 1 row, got ${result.totalRows}`);
  assert(result.rows[0]["Name"] === "Alice White", "Whitespace trimmed from values");
  assert(result.headers[1] === "Name", "Whitespace trimmed from headers");
});

test("Empty file throws 400 error", () => {
  let threw = false;
  try {
    parseCsv(Buffer.from(""));
  } catch (err: any) {
    threw = true;
    assert(err.status === 400, "Expected status 400");
  }
  assert(threw, "Empty file must throw error");
});

test("File exceeding maximum rows limit throws 400 error", () => {
  let threw = false;
  const manyRows = "Roll,Name,Email\n" + Array.from({ length: 50 }, (_, i) => `${i},User,u@t.com`).join("\n");
  try {
    parseCsv(Buffer.from(manyRows), { maxRows: 10 });
  } catch (err: any) {
    threw = true;
    assert(err.status === 400, "Expected status 400 on row overflow");
  }
  assert(threw, "Excessive row count must throw error");
});

// --- 2. Header Mapper & Alias Dictionary Tests ---
console.log("\n--- 2. Header Mapper & Alias Dictionary Tests ---");

test("Header normalization handles case, spaces, dashes, and underscores", () => {
  assert(normalizeHeader("Roll No") === "roll_no", "Normalize space");
  assert(normalizeHeader("Student-Name") === "student_name", "Normalize hyphen");
  assert(normalizeHeader("  EMAIL_ADDRESS  ") === "email_address", "Normalize underscores and trim");
  assert(normalizeHeader("Candidate.Name") === "candidate_name", "Normalize dots");
});

test("Student auto-mapping: standard headers", () => {
  const headers = ["Roll No", "Full Name", "Email", "Section", "Admission Year", "Lab Group"];
  const mappings = detectHeaderMappings(headers, "student");
  assert(mappings["Roll No"] === "roll_no", "Roll No -> roll_no");
  assert(mappings["Full Name"] === "full_name", "Full Name -> full_name");
  assert(mappings["Email"] === "email", "Email -> email");
  assert(mappings["Section"] === "section", "Section -> section");
  assert(mappings["Admission Year"] === "admission_year", "Admission Year -> admission_year");
  assert(mappings["Lab Group"] === "lab_group", "Lab Group -> lab_group");
});

test("Student auto-mapping: alternative headers (PRN, Candidate, Mail, Div, Group)", () => {
  const headers = ["PRN", "Candidate Name", "Mail", "Division", "Practical Group", "Batch Year"];
  const mappings = detectHeaderMappings(headers, "student");
  assert(mappings["PRN"] === "roll_no", "PRN -> roll_no");
  assert(mappings["Candidate Name"] === "full_name", "Candidate Name -> full_name");
  assert(mappings["Mail"] === "email", "Mail -> email");
  assert(mappings["Division"] === "section", "Division -> section");
  assert(mappings["Practical Group"] === "lab_group", "Practical Group -> lab_group");
  assert(mappings["Batch Year"] === "admission_year", "Batch Year -> admission_year");
});

test("Student auto-mapping: random column ordering with irrelevant columns", () => {
  const headers = ["Serial No", "Blood Group", "Mail", "Seat No", "Random Column", "Candidate", "Div", "Join Year"];
  const mappings = detectHeaderMappings(headers, "student");
  assert(mappings["Seat No"] === "roll_no", "Seat No -> roll_no");
  assert(mappings["Candidate"] === "full_name", "Candidate -> full_name");
  assert(mappings["Mail"] === "email", "Mail -> email");
  assert(mappings["Div"] === "section", "Div -> section");
  assert(mappings["Join Year"] === "admission_year", "Join Year -> admission_year");
  assert(mappings["Serial No"] === undefined, "Serial No remains unmapped");
  assert(mappings["Blood Group"] === undefined, "Blood Group remains unmapped");
  assert(mappings["Random Column"] === undefined, "Random Column remains unmapped");
});

test("Faculty auto-mapping: standard and alternative headers", () => {
  const headers = ["Emp ID", "Teacher Name", "Official Email", "Dept", "Position"];
  const mappings = detectHeaderMappings(headers, "faculty");
  assert(mappings["Emp ID"] === "employee_code", "Emp ID -> employee_code");
  assert(mappings["Teacher Name"] === "full_name", "Teacher Name -> full_name");
  assert(mappings["Official Email"] === "email", "Official Email -> email");
  assert(mappings["Dept"] === "department", "Dept -> department");
  assert(mappings["Position"] === "designation", "Position -> designation");
});

test("Conservative matching: ambiguous duplicate matches are not silently mapped", () => {
  // If a CSV has both "Email ID" and "Student Email", both map to "email".
  // The system must leave them unmapped for explicit admin choice.
  const headers = ["Roll No", "Name", "Email ID", "Student Email"];
  const mappings = detectHeaderMappings(headers, "student");
  assert(mappings["Roll No"] === "roll_no", "Roll No mapped");
  assert(mappings["Name"] === "full_name", "Name mapped");
  assert(mappings["Email ID"] === undefined, "Ambiguous Email ID left unmapped");
  assert(mappings["Student Email"] === undefined, "Ambiguous Student Email left unmapped");
});

// --- 3. CSV Serializer Tests ---
console.log("\n--- 3. CSV Serializer Tests ---");

test("RFC 4180 CSV serialization with quotes, commas, and BOM", () => {
  const headers = ["Row", "Name", "Error"];
  const rows = [
    [1, 'Doe, "The Great" John', "Invalid section; not found"],
    [2, "Jane Smith", "Duplicate roll number"],
  ];
  const csv = serializeToCsv(headers, rows);
  assert(csv.charCodeAt(0) === 0xfeff, "Contains UTF-8 BOM");
  assert(csv.includes('"Doe, ""The Great"" John"'), "Escapes internal quotes properly");
  assert(csv.includes('"Invalid section; not found"'), "Quotes field with semicolon");
});

// --- 4. Password Policy Conventions ---
console.log("\n--- 4. Password Policy Conventions ---");

test("Deterministic password format verification", () => {
  const studentRoll = "24B-CO-049";
  const facultyCode = "EMP101";

  const studentPass = `Acad@${studentRoll}`;
  const facultyPass = `Staff@${facultyCode}`;

  assert(studentPass === "Acad@24B-CO-049", "Student password format matches Acad@<RollNo>");
  assert(facultyPass === "Staff@EMP101", "Faculty password format matches Staff@<EmployeeCode>");
});

// --- 5. Row Validation & Reference Resolution Unit Tests ---
console.log("\n--- 5. Row Validation & Reference Resolution Tests ---");

import {
  cleanSectionName,
  cleanLabGroupName,
  validateStudentRow,
  validateFacultyRow,
  type InstitutionalCache,
} from "../src/services/import.service";

test("Section and lab group name cleaning", () => {
  assert(cleanSectionName("Section A") === "A", "Clean 'Section A'");
  assert(cleanSectionName("Sec B") === "B", "Clean 'Sec B'");
  assert(cleanSectionName("Division C") === "C", "Clean 'Division C'");
  assert(cleanSectionName("div D") === "D", "Clean 'div D'");
  assert(cleanSectionName("A") === "A", "Keep 'A'");

  assert(cleanLabGroupName("Lab Group A1") === "A1", "Clean 'Lab Group A1'");
  assert(cleanLabGroupName("Group A2") === "A2", "Clean 'Group A2'");
  assert(cleanLabGroupName("Batch B1") === "B1", "Clean 'Batch B1'");
  assert(cleanLabGroupName("A1") === "A1", "Keep 'A1'");
});

const mockCache: InstitutionalCache = {
  departments: [
    { id: 1, name: "Computer Engineering", code: "CO" },
    { id: 2, name: "Mechanical Engineering", code: "ME" },
  ],
  programs: [{ id: 1, department_id: 1, name: "B.E. Computer Engineering", level: "B.E." }],
  batches: [{ id: 1, program_id: 1, start_year: 2024, end_year: 2028 }],
  sections: [
    { id: 10, batch_id: 1, name: "A", department_id: 1 },
    { id: 20, batch_id: 1, name: "B", department_id: 1 },
  ],
  labGroups: [
    { id: 101, section_id: 10, name: "A1" },
    { id: 102, section_id: 10, name: "A2" },
  ],
  existingEmails: new Set(["existing@test.com"]),
  existingStudentRolls: new Set(["24b-co-049"]),
  existingFacultyCodes: new Set(["emp101"]),
};

const studentMapping = {
  roll: "roll_no",
  name: "full_name",
  mail: "email",
  sec: "section",
  year: "admission_year",
  group: "lab_group",
  dept: "department",
};

test("Student row validation: valid record", () => {
  const seenRolls = new Set<string>();
  const seenEmails = new Set<string>();
  const raw = {
    roll: "24B-CO-099",
    name: "Valid Student",
    mail: "valid.student@test.com",
    sec: "Section A",
    year: "2024",
    group: "A1",
    dept: "CO",
  };
  const result = validateStudentRow(raw, 2, studentMapping, mockCache, {}, seenRolls, seenEmails);
  assert(result.isValid, `Expected valid, got errors: ${result.errors.join(", ")}`);
  assert(result.mappedData.section_id === 10, "Resolved section id 10");
  assert(result.mappedData.lab_group_id === 101, "Resolved lab group id 101");
});

test("Student row validation: catches missing required fields", () => {
  const seenRolls = new Set<string>();
  const seenEmails = new Set<string>();
  const raw = { roll: "", name: "", mail: "", sec: "", year: "" };
  const result = validateStudentRow(raw, 2, studentMapping, mockCache, {}, seenRolls, seenEmails);
  assert(!result.isValid, "Must be invalid");
  assert(result.errors.some((e) => e.includes("Roll number is required")), "Error on roll");
  assert(result.errors.some((e) => e.includes("Full name is required")), "Error on name");
  assert(result.errors.some((e) => e.includes("Email is required")), "Error on email");
  assert(result.errors.some((e) => e.includes("Section is required")), "Error on section");
  assert(result.errors.some((e) => e.includes("Admission year is required")), "Error on year");
});

test("Student row validation: catches invalid email format and duplicate email in file", () => {
  const seenRolls = new Set<string>();
  const seenEmails = new Set<string>();
  const rawBadEmail = { roll: "24B-CO-101", name: "Bad Email", mail: "notanemail", sec: "A", year: "2024" };
  const res1 = validateStudentRow(rawBadEmail, 2, studentMapping, mockCache, {}, seenRolls, seenEmails);
  assert(!res1.isValid && res1.errors.some((e) => e.includes("Invalid email format")), "Catches bad email");

  const rawGood = { roll: "24B-CO-102", name: "First", mail: "dup@test.com", sec: "A", year: "2024" };
  validateStudentRow(rawGood, 3, studentMapping, mockCache, {}, seenRolls, seenEmails);

  const rawDup = { roll: "24B-CO-103", name: "Second", mail: "dup@test.com", sec: "A", year: "2024" };
  const res2 = validateStudentRow(rawDup, 4, studentMapping, mockCache, {}, seenRolls, seenEmails);
  assert(!res2.isValid && res2.errors.some((e) => e.includes("Duplicate email")), "Catches in-file duplicate email");
});

test("Student row validation: catches existing DB duplicates", () => {
  const seenRolls = new Set<string>();
  const seenEmails = new Set<string>();
  const raw = { roll: "24B-CO-049", name: "Existing Roll", mail: "existing@test.com", sec: "A", year: "2024" };
  const res = validateStudentRow(raw, 2, studentMapping, mockCache, {}, seenRolls, seenEmails);
  assert(!res.isValid, "Must flag DB duplicates");
  assert(res.errors.some((e) => e.includes("already exists in database")), "Flags roll in DB");
  assert(res.errors.some((e) => e.includes("already registered in the system")), "Flags email in DB");
});

test("Student row validation: catches invalid admission year", () => {
  const seenRolls = new Set<string>();
  const seenEmails = new Set<string>();
  const raw = { roll: "24B-CO-110", name: "Time Traveler", mail: "time@test.com", sec: "A", year: "1995" };
  const res = validateStudentRow(raw, 2, studentMapping, mockCache, {}, seenRolls, seenEmails);
  assert(!res.isValid && res.errors.some((e) => e.includes("Invalid admission year")), "Flags year < 2000");
});

test("Student row validation: catches non-existent section and mismatched lab group", () => {
  const seenRolls = new Set<string>();
  const seenEmails = new Set<string>();
  const raw1 = { roll: "24B-CO-111", name: "No Section", mail: "s1@test.com", sec: "NonExistentZ", year: "2024" };
  const res1 = validateStudentRow(raw1, 2, studentMapping, mockCache, {}, seenRolls, seenEmails);
  assert(!res1.isValid && res1.errors.some((e) => e.includes("Section 'NonExistentZ' not found")), "Flags missing section");

  const raw2 = { roll: "24B-CO-112", name: "Wrong Group", mail: "s2@test.com", sec: "B", year: "2024", group: "A1" };
  const res2 = validateStudentRow(raw2, 3, studentMapping, mockCache, {}, seenRolls, seenEmails);
  assert(!res2.isValid && res2.errors.some((e) => e.includes("Lab group 'A1' does not belong")), "Flags lab group not in section B");
});

const facultyMapping = {
  emp_id: "employee_code",
  name: "full_name",
  email: "email",
  dept: "department",
  post: "designation",
};

test("Faculty row validation: valid record", () => {
  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();
  const raw = {
    emp_id: "EMP999",
    name: "Dr. New Faculty",
    email: "new.fac@test.com",
    dept: "CO",
    post: "Professor",
  };
  const res = validateFacultyRow(raw, 2, facultyMapping, mockCache, { departmentId: 1 }, seenCodes, seenEmails);
  assert(res.isValid, `Expected valid, got: ${res.errors.join(", ")}`);
  assert(res.mappedData.department_id === 1, "Department id 1 resolved");
  assert(res.mappedData.designation === "Professor", "Designation preserved");
});

test("Faculty row validation: catches cross-department scoping violation for Dept Admin", () => {
  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();
  const raw = {
    emp_id: "EMP888",
    name: "Mechanical Faculty",
    email: "mech.fac@test.com",
    dept: "ME", // User belongs to CO (dept 1), but tries to import to ME (dept 2)
  };
  const res = validateFacultyRow(raw, 2, facultyMapping, mockCache, { departmentId: 1 }, seenCodes, seenEmails);
  assert(!res.isValid, "Cross department must fail");
  assert(res.errors.some((e) => e.includes("violates your authorized department scope")), "Flags scope violation");
});

test("Faculty row validation: catches duplicate code in file and existing in DB", () => {
  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();
  const raw1 = { emp_id: "EMP101", name: "Cloned Emp", email: "clone@test.com", dept: "CO" };
  const res1 = validateFacultyRow(raw1, 2, facultyMapping, mockCache, {}, seenCodes, seenEmails);
  assert(!res1.isValid && res1.errors.some((e) => e.includes("already exists in database")), "Flags existing emp code in DB");

  const raw2 = { emp_id: "EMP777", name: "One", email: "one@test.com", dept: "CO" };
  validateFacultyRow(raw2, 3, facultyMapping, mockCache, {}, seenCodes, seenEmails);

  const raw3 = { emp_id: "EMP777", name: "Two", email: "two@test.com", dept: "CO" };
  const res3 = validateFacultyRow(raw3, 4, facultyMapping, mockCache, {}, seenCodes, seenEmails);
  assert(!res3.isValid && res3.errors.some((e) => e.includes("Duplicate employee code")), "Flags duplicate code in file");
});

console.log("\n=======================================================");
console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
console.log("=======================================================\n");

if (failedCount > 0) {
  process.exit(1);
}

