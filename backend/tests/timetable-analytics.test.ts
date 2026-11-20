import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { parseCsv } from "../src/utils/csv/parser";
import {
  detectHeaderMappings,
  getCanonicalFields,
} from "../src/utils/csv/header-mapper";
import {
  generateTimetableTemplate,
  previewCsv,
} from "../src/services/import.service";
import { getDepartmentAnalytics } from "../src/services/reports.service";
import pool from "../src/config/db";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failedCount++;
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(message);
  }
}

async function testAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passedCount++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err: any) {
    failedCount++;
    console.error(`  ✗ FAIL: ${name}: ${err.message}`);
  }
}

function test(name: string, fn: () => void) {
  try {
    fn();
    passedCount++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err: any) {
    failedCount++;
    console.error(`  ✗ FAIL: ${name}: ${err.message}`);
  }
}

async function run() {
  console.log("\n=======================================================");
  console.log("   AcadTrack Timetable CSV & Analytics Test Suite     ");
  console.log("=======================================================\n");

  // --- 1. Timetable Header Mapping Tests ---
  console.log("--- 1. Timetable Header Mapping Tests ---");

  test("Timetable canonical fields are defined", () => {
    const fields = getCanonicalFields("timetable");
    const required = [
      "subject_code",
      "faculty_code",
      "section",
      "day_of_week",
      "room",
    ];
    for (const req of required) {
      assert(fields.some((f) => f.key === req && f.required), `Expected ${req} to be required`);
    }
    const optional = ["lab_group", "period_no", "start_time", "end_time", "academic_term"];
    for (const opt of optional) {
      assert(fields.some((f) => f.key === opt && !f.required), `Expected ${opt} to be optional`);
    }
  });

  test("Auto-mapping standard timetable headers", () => {
    const headers = [
      "Subject Code",
      "Faculty Code",
      "Section",
      "Lab Group",
      "Day",
      "Period",
      "Start Time",
      "End Time",
      "Room",
      "Academic Term",
    ];
    const mappings = detectHeaderMappings(headers, "timetable");
    assert(mappings["Subject Code"] === "subject_code", "Expected Subject Code -> subject_code");
    assert(mappings["Faculty Code"] === "faculty_code", "Expected Faculty Code -> faculty_code");
    assert(mappings["Section"] === "section", "Expected Section -> section");
    assert(mappings["Lab Group"] === "lab_group", "Expected Lab Group -> lab_group");
    assert(mappings["Day"] === "day_of_week", "Expected Day -> day_of_week");
    assert(mappings["Period"] === "period_no", "Expected Period -> period_no");
    assert(mappings["Start Time"] === "start_time", "Expected Start Time -> start_time");
    assert(mappings["End Time"] === "end_time", "Expected End Time -> end_time");
    assert(mappings["Room"] === "room", "Expected Room -> room");
    assert(mappings["Academic Term"] === "academic_term", "Expected Academic Term -> academic_term");
  });

  test("Auto-mapping alternative headers and export format", () => {
    // Matches exportSlotsCsv headers
    const exportedHeaders = [
      "Day",
      "Period",
      "Time",
      "Subject Code",
      "Subject Name",
      "Faculty Name",
      "Faculty Code",
      "Section",
      "Lab Group",
      "Room",
    ];
    const mappings = detectHeaderMappings(exportedHeaders, "timetable");
    assert(mappings["Subject Code"] === "subject_code", "Exported Subject Code -> subject_code");
    assert(mappings["Faculty Code"] === "faculty_code", "Exported Faculty Code -> faculty_code");
    assert(mappings["Section"] === "section", "Exported Section -> section");
    assert(mappings["Lab Group"] === "lab_group", "Exported Lab Group -> lab_group");
    assert(mappings["Day"] === "day_of_week", "Exported Day -> day_of_week");
    assert(mappings["Room"] === "room", "Exported Room -> room");
  });

  // --- 2. Database & Service Tests ---
  console.log("\n--- 2. Database Timetable & Analytics Service Tests ---");

  let collegeId = 1;
  let deptId = 1;

  await testAsync("Fetch test college & department", async () => {
    const res = await pool.query("SELECT id FROM college LIMIT 1");
    assert(res.rows.length > 0, "College exists");
    collegeId = res.rows[0].id;

    const dRes = await pool.query("SELECT id FROM department WHERE college_id = $1 LIMIT 1", [collegeId]);
    assert(dRes.rows.length > 0, "Department exists");
    deptId = dRes.rows[0].id;
  });

  await testAsync("Generate dynamic timetable CSV template", async () => {
    const template = await generateTimetableTemplate(collegeId, deptId);
    assert(typeof template.csv === "string" && template.csv.length > 0, "Template csv generated");
    assert(template.csv.includes("Subject Code,Faculty Code,Section,Lab Group"), "Headers present in template");
    const parsed = parseCsv(Buffer.from(template.csv));
    assert(parsed.totalRows > 0, "Template contains sample department rows");
  });

  await testAsync("Timetable CSV Preview validates sample template", async () => {
    const template = await generateTimetableTemplate(collegeId, deptId);
    const parsed = parseCsv(Buffer.from(template.csv));
    const mappings = detectHeaderMappings(parsed.headers, "timetable");

    const preview = await previewCsv(
      collegeId,
      Buffer.from(template.csv),
      "timetable",
      mappings,
      { departmentId: deptId },
    );

    assert(preview.validRowCount > 0, `Expected valid rows, got ${preview.validRowCount}`);
    assert(preview.invalidRowCount === 0, `Expected 0 invalid rows in template, got ${preview.invalidRowCount}`);
  });

  await testAsync("Timetable CSV Preview catches room and faculty clashes", async () => {
    // Generate a CSV with intentional clashes on Saturday (Day 6) Period 1
    const csvContent = [
      "Subject Code,Faculty Code,Section,Lab Group,Day,Period,Start Time,End Time,Room,Academic Term",
      "CO501,EMP101,A,,Saturday,1,09:00,10:00,R101,AY 2026-2027",
      "CO502,EMP101,B,,Saturday,1,09:00,10:00,R102,AY 2026-2027", // Faculty EMP101 clash!
      "CO503,EMP102,A,,Saturday,1,09:00,10:00,R101,AY 2026-2027", // Room R101 clash & Section A whole-class clash!
    ].join("\n");

    const parsed = parseCsv(Buffer.from(csvContent));
    const mappings = detectHeaderMappings(parsed.headers, "timetable");

    const preview = await previewCsv(
      collegeId,
      Buffer.from(csvContent),
      "timetable",
      mappings,
      { departmentId: deptId },
    );

    assert(preview.previewRows.length === 3, "Expected 3 rows");
    assert(preview.previewRows[0].isValid === true, `Row 1 should be valid, but got: ${preview.previewRows[0].errors.join(", ")}`);
    assert(preview.previewRows[1].isValid === false, "Row 2 should fail due to faculty clash");
    assert(preview.previewRows[1].errors.some(e => e.includes("Faculty") || e.includes("clash")), "Row 2 reports faculty clash error");
    assert(preview.previewRows[2].isValid === false, "Row 3 should fail due to room / section clash");
    assert(preview.previewRows[2].errors.some(e => e.includes("Room") || e.includes("Section")), "Row 3 reports clash error");
  });

  await testAsync("Timetable CSV Preview validates lab subject group rules", async () => {
    const labSub = await pool.query("SELECT code FROM subject WHERE subject_type = 'lab' AND department_id = $1 LIMIT 1", [deptId]);
    if (labSub.rows.length > 0) {
      const code = labSub.rows[0].code;
      // Missing lab group for lab subject
      const csvContent = [
        "Subject Code,Faculty Code,Section,Lab Group,Day,Period,Start Time,End Time,Room,Academic Term",
        `${code},EMP101,A,,Tuesday,2,10:00,11:00,LAB-1,AY 2026-2027`,
      ].join("\n");

      const parsed = parseCsv(Buffer.from(csvContent));
      const mappings = detectHeaderMappings(parsed.headers, "timetable");

      const preview = await previewCsv(
        collegeId,
        Buffer.from(csvContent),
        "timetable",
        mappings,
        { departmentId: deptId },
      );

      assert(preview.previewRows[0].isValid === false, "Lab subject without lab group must be invalid");
      assert(preview.previewRows[0].errors.some(e => e.toLowerCase().includes("lab group")), "Reports missing lab group");
    }
  });

  await testAsync("College Admin Analytics calculates real dynamic data for all departments", async () => {
    const analytics = await getDepartmentAnalytics(collegeId);
    assert(analytics.length > 0, "Returns departments");

    // Verify all departments belonging to the college are returned
    const depts = await pool.query("SELECT COUNT(*) AS count FROM department WHERE college_id = $1", [collegeId]);
    const expectedCount = parseInt(depts.rows[0].count, 10);
    assert(analytics.length === expectedCount, `Expected all ${expectedCount} departments, got ${analytics.length}`);

    // Verify student count across sections
    for (const row of analytics) {
      assert(typeof row.total_students === "number", "total_students is a number");
      assert(typeof row.total_faculty === "number", "total_faculty is a number");
      assert(row.average_attendance_pct !== undefined, "average_attendance_pct is defined");
      assert(row.below_threshold_count !== undefined, "below_threshold_count is defined");
      assert(row.eligible_count !== undefined, "eligible_count is defined");
    }
  });

  console.log("\n=======================================================");
  console.log(`Results: ${passedCount} passed, ${failedCount} failed`);
  console.log("=======================================================\n");

  await pool.end();
  if (failedCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
