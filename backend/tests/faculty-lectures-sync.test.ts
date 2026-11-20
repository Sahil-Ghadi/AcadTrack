import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import pool from "../src/config/db";
import {
  getFacultyLectures,
  getSessionStudents,
  submitAttendance,
  ensureLectureSessionsForDate,
} from "../src/services/attendance.service";
import { getCurrentTerm } from "../src/services/institution.service";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failedCount++;
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(message);
  }
}

async function cleanupTestDate(dateStr: string) {
  try {
    await pool.query("ALTER TABLE lecture_session DISABLE TRIGGER lecture_session_guard");
    await pool.query("ALTER TABLE attendance DISABLE TRIGGER attendance_guard");
    await pool.query(
      "DELETE FROM attendance WHERE lecture_session_id IN (SELECT id FROM lecture_session WHERE session_date = $1)",
      [dateStr]
    );
    await pool.query("DELETE FROM lecture_session WHERE session_date = $1", [dateStr]);
  } finally {
    await pool.query("ALTER TABLE attendance ENABLE TRIGGER attendance_guard");
    await pool.query("ALTER TABLE lecture_session ENABLE TRIGGER lecture_session_guard");
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

async function run() {
  console.log("\n=======================================================");
  console.log("   AcadTrack Faculty Lecture Sync & Term Test Suite    ");
  console.log("=======================================================\n");

  const collegeId = 1;
  const testDate = "2026-11-17"; // Tuesday

  // Faculty User IDs from seed data:
  // user_id 3: Dr. Meera Kulkarni (EMP101) -> CO501 DBMS
  // user_id 4: Prof. Anil Desai (EMP102) -> CO502 OS
  // user_id 5: Prof. Neha Prabhu (EMP103) -> CO503 CN

  // --- 1. Academic Term Resolution Consistency ---
  console.log("--- 1. Academic Term Resolution Consistency ---");

  await testAsync("Active academic term is consistently resolved from database", async () => {
    const term = await getCurrentTerm(collegeId);
    assert(term !== null, "Current academic term exists");
    assert(term.academic_year === "2026-2027", `Expected AY 2026-2027, got ${term.academic_year}`);
    assert(term.term_type === "odd", `Expected odd semester, got ${term.term_type}`);
    assert(term.is_current === true, "Term is marked active (is_current = true)");

    // Verify test date falls within the term date range
    const inRangeRes = await pool.query(
      `SELECT ($1::date >= start_date AND $1::date <= end_date) AS in_range
         FROM academic_term WHERE id = $2`,
      [testDate, term.id]
    );
    assert(inRangeRes.rows[0].in_range === true, `Date ${testDate} must fall within term dates`);
  });

  // Clean up any existing sessions on testDate before test run
  await cleanupTestDate(testDate);

  // --- 2. Synchronized Lecture Retrieval for Tuesday Nov 17, 2026 ---
  console.log("\n--- 2. Synchronized Lecture Retrieval for Tuesday Nov 17, 2026 ---");

  await testAsync("CO501 faculty (Dr. Meera Kulkarni) sees Tuesday DBMS lecture", async () => {
    const meeraUserId = 3;
    const lectures = await getFacultyLectures(collegeId, meeraUserId, { date: testDate });

    assert(lectures.length === 1, `Expected exactly 1 lecture for Dr. Meera Kulkarni on Tuesday, got ${lectures.length}`);
    const lec = lectures[0];
    assert(lec.subject_code === "CO501", `Expected CO501, got ${lec.subject_code}`);
    assert(lec.period_no === 3, `Expected Period 3, got ${lec.period_no}`);
    assert(lec.room === "R305", `Expected Room R305, got ${lec.room}`);
    assert(lec.section_name === "A", `Expected Section A, got ${lec.section_name}`);
    assert(lec.status === "scheduled", `Expected status 'scheduled', got ${lec.status}`);
    assert(lec.is_locked === false, "Expected is_locked to be false");
  });

  await testAsync("CO502 faculty (Prof. Anil Desai) sees Tuesday OS lecture", async () => {
    const anilUserId = 4;
    const lectures = await getFacultyLectures(collegeId, anilUserId, { date: testDate });

    assert(lectures.length === 1, `Expected exactly 1 lecture for Prof. Anil Desai, got ${lectures.length}`);
    const lec = lectures[0];
    assert(lec.subject_code === "CO502", `Expected CO502, got ${lec.subject_code}`);
    assert(lec.period_no === 1, `Expected Period 1, got ${lec.period_no}`);
    assert(lec.room === "R204", `Expected Room R204, got ${lec.room}`);
  });

  await testAsync("CO503 faculty (Prof. Neha Prabhu) sees Tuesday CN lecture", async () => {
    const nehaUserId = 5;
    const lectures = await getFacultyLectures(collegeId, nehaUserId, { date: testDate });

    assert(lectures.length === 1, `Expected exactly 1 lecture for Prof. Neha Prabhu, got ${lectures.length}`);
    const lec = lectures[0];
    assert(lec.subject_code === "CO503", `Expected CO503, got ${lec.subject_code}`);
    assert(lec.period_no === 2, `Expected Period 2, got ${lec.period_no}`);
    assert(lec.room === "R204", `Expected Room R204, got ${lec.room}`);
  });

  await testAsync("Faculty cannot see another faculty member's lectures", async () => {
    const meeraUserId = 3;
    const lectures = await getFacultyLectures(collegeId, meeraUserId, { date: testDate });

    // Dr. Meera Kulkarni should not see CO502 or CO503
    assert(!lectures.some((l) => l.subject_code === "CO502"), "Dr. Meera should NOT see CO502");
    assert(!lectures.some((l) => l.subject_code === "CO503"), "Dr. Meera should NOT see CO503");
  });

  // --- 3. Empty State on Non-Scheduled Days ---
  console.log("\n--- 3. Empty State on Days with No Scheduled Lectures ---");

  await testAsync("Selecting Saturday displays empty list (0 lectures)", async () => {
    const saturday = "2026-11-21"; // Saturday (no slots in seed timetable)
    const meeraUserId = 3;
    const lectures = await getFacultyLectures(collegeId, meeraUserId, { date: saturday });
    assert(lectures.length === 0, `Expected 0 lectures on Saturday, got ${lectures.length}`);
  });

  await testAsync("Selecting Sunday displays empty list (0 lectures)", async () => {
    const sunday = "2026-11-22"; // Sunday (university closed)
    const meeraUserId = 3;
    const lectures = await getFacultyLectures(collegeId, meeraUserId, { date: sunday });
    assert(lectures.length === 0, `Expected 0 lectures on Sunday, got ${lectures.length}`);
  });

  // --- 4. Idempotence & Concurrency Safety ---
  console.log("\n--- 4. Idempotence & Concurrency Safety ---");

  await testAsync("Selecting the same date repeatedly does not create duplicate lecture sessions", async () => {
    const initialCountRes = await pool.query(
      "SELECT COUNT(*) FROM lecture_session WHERE session_date = $1",
      [testDate]
    );
    const initialCount = parseInt(initialCountRes.rows[0].count, 10);
    assert(initialCount === 3, `Expected 3 materialized sessions on Tuesday, got ${initialCount}`);

    // Call materialization 3 more times
    await ensureLectureSessionsForDate(collegeId, testDate);
    await ensureLectureSessionsForDate(collegeId, testDate);
    await ensureLectureSessionsForDate(collegeId, testDate);

    const afterCountRes = await pool.query(
      "SELECT COUNT(*) FROM lecture_session WHERE session_date = $1",
      [testDate]
    );
    const afterCount = parseInt(afterCountRes.rows[0].count, 10);
    assert(afterCount === initialCount, `Session count must not increase: expected ${initialCount}, got ${afterCount}`);
  });

  // --- 5. Attendance Workflow & State Preservation ---
  console.log("\n--- 5. Attendance Workflow & State Preservation ---");

  let testSessionId: number;

  await testAsync("Session returns eligible students from Section A", async () => {
    const meeraUserId = 3;
    const lectures = await getFacultyLectures(collegeId, meeraUserId, { date: testDate });
    testSessionId = lectures[0].id;

    const data = await getSessionStudents(testSessionId, collegeId);
    assert(data !== null, "Session details returned");
    assert(data.students.length >= 10, `Expected at least 10 students in Section A, got ${data.students.length}`);
    assert(data.students[0].roll_no === "24B-CO-001", "Expected student 24B-CO-001");
  });

  await testAsync("Faculty can mark and lock attendance on materialized session", async () => {
    const meeraUserId = 3;
    const data = await getSessionStudents(testSessionId, collegeId);
    const records = data!.students.map((s: any, idx: number) => ({
      student_id: s.id,
      status: (idx % 2 === 0 ? "present" : "absent") as "present" | "absent",
    }));

    // Submit and lock attendance
    await submitAttendance(testSessionId, collegeId, meeraUserId, "faculty", records, true);

    const sessionCheck = await pool.query(
      "SELECT is_locked, status FROM lecture_session WHERE id = $1",
      [testSessionId]
    );
    assert(sessionCheck.rows[0].is_locked === true, "Session must be locked");
    assert(sessionCheck.rows[0].status === "held", "Session status must be flipped to 'held'");

    // Verify re-materialization DOES NOT overwrite locked session or attendance
    await ensureLectureSessionsForDate(collegeId, testDate);

    const recheck = await pool.query(
      "SELECT is_locked, status FROM lecture_session WHERE id = $1",
      [testSessionId]
    );
    assert(recheck.rows[0].is_locked === true, "Locked session must NOT be unlocked");
    assert(recheck.rows[0].status === "held", "Held status must NOT be reset");

    const attCount = await pool.query(
      "SELECT COUNT(*) FROM attendance WHERE lecture_session_id = $1",
      [testSessionId]
    );
    assert(parseInt(attCount.rows[0].count, 10) === records.length, `All ${records.length} attendance records must be preserved`);
  });

  // Clean up test attendance and sessions on testDate
  await cleanupTestDate(testDate);

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
