import bcrypt from "bcrypt";
import pool from "../config/db";
import { parseCsv } from "../utils/csv/parser";
import {
  type EntityType,
  getCanonicalFields,
  detectHeaderMappings,
} from "../utils/csv/header-mapper";
import { serializeToCsv } from "../utils/csv/csv-serializer";

export interface ImportContext {
  departmentId?: number;
  programId?: number;
  batchId?: number;
  sectionId?: number;
  skipErrors?: boolean;
  assignmentId?: number;
  component?: "IT1" | "IT2" | "IT3" | "ASSIGNMENT";
  sessionId?: number;
  termId?: number;
  userId?: number;
  userRole?: string;
}

export interface RowError {
  rowNumber: number;
  identifier?: string;
  field?: string;
  error: string;
}

export interface RowPreview {
  rowNumber: number;
  raw: Record<string, string>;
  mapped: Record<string, any>;
  isValid: boolean;
  errors: string[];
}

export interface PreviewResult {
  headers: string[];
  suggestedMappings: Record<string, string>;
  canonicalFields: Array<{
    key: string;
    label: string;
    required: boolean;
    description: string;
  }>;
  totalRows: number;
  validRowCount: number;
  invalidRowCount: number;
  previewRows: RowPreview[];
  errors: RowError[];
}

export interface ExecuteResult {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: RowError[];
  errorCsv?: string;
}

export interface InstitutionalCache {
  departments: Array<{ id: number; name: string; code: string }>;
  programs: Array<{ id: number; department_id: number; name: string; level: string }>;
  batches: Array<{ id: number; program_id: number; start_year: number; end_year: number }>;
  sections: Array<{ id: number; batch_id: number; name: string; department_id: number }>;
  labGroups: Array<{ id: number; section_id: number; name: string }>;
  existingEmails: Set<string>;
  existingStudentRolls: Set<string>;
  existingFacultyCodes: Set<string>;
}

/**
 * Pre-fetch institutional metadata and existing unique values for the tenant college.
 */
async function loadInstitutionalCache(collegeId: number): Promise<InstitutionalCache> {
  const [deptRes, progRes, batchRes, secRes, lgRes, userRes, studRes, facRes] = await Promise.all([
    pool.query(`SELECT id, name, code FROM department WHERE college_id = $1 AND is_active = true`, [collegeId]),
    pool.query(
      `SELECT p.id, p.department_id, p.name, p.level
         FROM program p
         JOIN department d ON d.id = p.department_id
        WHERE d.college_id = $1 AND p.is_active = true`,
      [collegeId],
    ),
    pool.query(
      `SELECT b.id, b.program_id, b.start_year, b.end_year
         FROM batch b
         JOIN program p    ON p.id = b.program_id
         JOIN department d ON d.id = p.department_id
        WHERE d.college_id = $1 AND b.is_active = true`,
      [collegeId],
    ),
    pool.query(
      `SELECT s.id, s.batch_id, s.name, p.department_id
         FROM section s
         JOIN batch b      ON b.id = s.batch_id
         JOIN program p    ON p.id = b.program_id
         JOIN department d ON d.id = p.department_id
        WHERE d.college_id = $1`,
      [collegeId],
    ),
    pool.query(
      `SELECT lg.id, lg.section_id, lg.name
         FROM lab_group lg
         JOIN section s    ON s.id = lg.section_id
         JOIN batch b      ON b.id = s.batch_id
         JOIN program p    ON p.id = b.program_id
         JOIN department d ON d.id = p.department_id
        WHERE d.college_id = $1`,
      [collegeId],
    ),
    pool.query(`SELECT LOWER(email) AS email FROM app_user WHERE college_id = $1`, [collegeId]),
    pool.query(
      `SELECT LOWER(s.roll_no) AS roll_no
         FROM student s
         JOIN app_user u ON u.id = s.user_id
        WHERE u.college_id = $1`,
      [collegeId],
    ),
    pool.query(
      `SELECT LOWER(f.employee_code) AS employee_code
         FROM faculty f
         JOIN app_user u ON u.id = f.user_id
        WHERE u.college_id = $1`,
      [collegeId],
    ),
  ]);

  return {
    departments: deptRes.rows.map((r: any) => ({ id: Number(r.id), name: r.name, code: r.code })),
    programs: progRes.rows.map((r: any) => ({ id: Number(r.id), department_id: Number(r.department_id), name: r.name, level: r.level })),
    batches: batchRes.rows.map((r: any) => ({ id: Number(r.id), program_id: Number(r.program_id), start_year: Number(r.start_year), end_year: Number(r.end_year) })),
    sections: secRes.rows.map((r: any) => ({ id: Number(r.id), batch_id: Number(r.batch_id), name: r.name, department_id: Number(r.department_id) })),
    labGroups: lgRes.rows.map((r: any) => ({ id: Number(r.id), section_id: Number(r.section_id), name: r.name })),
    existingEmails: new Set(userRes.rows.map((r: any) => r.email)),
    existingStudentRolls: new Set(studRes.rows.map((r: any) => r.roll_no)),
    existingFacultyCodes: new Set(facRes.rows.map((r: any) => r.employee_code)),
  };
}

/**
 * Clean section string representation: "Section A", "Sec A", "Division A" -> "A"
 */
export function cleanSectionName(raw: string): string {
  return raw
    .trim()
    .replace(/^(section|sec|division|div)[\s.:_-]*/i, "")
    .trim();
}

/**
 * Clean lab group string representation: "Lab Group A1", "Group A1", "Batch A1" -> "A1"
 */
export function cleanLabGroupName(raw: string): string {
  return raw
    .trim()
    .replace(/^(lab\s*group|group|batch|lab)[\s.:_-]*/i, "")
    .trim();
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate and map a student record against the database cache.
 */
export function validateStudentRow(
  rawRow: Record<string, string>,
  rowNumber: number,
  mapping: Record<string, string>,
  cache: InstitutionalCache,
  context: ImportContext,
  seenRolls: Set<string>,
  seenEmails: Set<string>,
): { isValid: boolean; mappedData: any; errors: string[] } {
  const errors: string[] = [];
  const mapped: Record<string, string> = {};

  for (const [sourceHeader, canonicalField] of Object.entries(mapping)) {
    if (canonicalField && rawRow[sourceHeader] !== undefined) {
      mapped[canonicalField] = rawRow[sourceHeader].trim();
    }
  }

  // 1. Roll Number
  const rollNo = mapped.roll_no || "";
  if (!rollNo) {
    errors.push("Roll number is required");
  } else {
    const rollLower = rollNo.toLowerCase();
    if (seenRolls.has(rollLower)) {
      errors.push(`Duplicate roll number '${rollNo}' within uploaded file`);
    } else {
      seenRolls.add(rollLower);
    }
    if (cache.existingStudentRolls.has(rollLower)) {
      errors.push(`Roll number '${rollNo}' already exists in database`);
    }
  }

  // 2. Full Name
  const fullName = mapped.full_name || "";
  if (!fullName) {
    errors.push("Full name is required");
  }

  // 3. Email
  const email = mapped.email || "";
  if (!email) {
    errors.push("Email is required");
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push(`Invalid email format '${email}'`);
  } else {
    const emailLower = email.toLowerCase();
    if (seenEmails.has(emailLower)) {
      errors.push(`Duplicate email '${email}' within uploaded file`);
    } else {
      seenEmails.add(emailLower);
    }
    if (cache.existingEmails.has(emailLower)) {
      errors.push(`Email '${email}' is already registered in the system`);
    }
  }

  // 4. Admission Year
  let admissionYear = 0;
  if (!mapped.admission_year) {
    errors.push("Admission year is required");
  } else {
    const parsedYear = parseInt(mapped.admission_year, 10);
    if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      errors.push(`Invalid admission year '${mapped.admission_year}' (must be 2000-2100)`);
    } else {
      admissionYear = parsedYear;
    }
  }

  // 5. Department resolution
  let departmentId: number | undefined = context.departmentId;
  if (mapped.department) {
    const deptQuery = mapped.department.toLowerCase();
    const matchedDept = cache.departments.find(
      (d) => d.code.toLowerCase() === deptQuery || d.name.toLowerCase() === deptQuery,
    );
    if (!matchedDept) {
      errors.push(`Department '${mapped.department}' not found in college`);
    } else if (context.departmentId && matchedDept.id !== context.departmentId) {
      errors.push(`Department '${mapped.department}' violates your authorized department scope`);
    } else {
      departmentId = matchedDept.id;
    }
  }

  // 6. Section resolution
  let sectionId: number | undefined = context.sectionId;
  const rawSection = mapped.section || "";
  if (!sectionId && !rawSection) {
    errors.push("Section is required");
  } else if (!sectionId && rawSection) {
    const cleanSec = cleanSectionName(rawSection);
    // Filter sections by department if department is known
    let candidateSections = cache.sections.filter(
      (s) => s.name.toLowerCase() === cleanSec.toLowerCase(),
    );
    if (departmentId) {
      candidateSections = candidateSections.filter((s) => s.department_id === departmentId);
    }
    if (context.batchId) {
      candidateSections = candidateSections.filter((s) => s.batch_id === context.batchId);
    }

    if (candidateSections.length === 0) {
      errors.push(`Section '${rawSection}' not found in department`);
    } else if (candidateSections.length > 1) {
      errors.push(`Ambiguous section '${rawSection}': exists in multiple batches. Specify Batch in CSV.`);
    } else {
      sectionId = candidateSections[0].id;
    }
  }

  // 7. Lab Group resolution (optional)
  let labGroupId: number | null = null;
  const rawLabGroup = mapped.lab_group || "";
  if (rawLabGroup && sectionId) {
    const cleanLg = cleanLabGroupName(rawLabGroup);
    const matchedLg = cache.labGroups.find(
      (lg) =>
        lg.section_id === sectionId &&
        (lg.name.toLowerCase() === cleanLg.toLowerCase() ||
          cleanLabGroupName(lg.name).toLowerCase() === cleanLg.toLowerCase()),
    );
    if (!matchedLg) {
      errors.push(`Lab group '${rawLabGroup}' does not belong to section '${rawSection || sectionId}'`);
    } else {
      labGroupId = matchedLg.id;
    }
  }

  return {
    isValid: errors.length === 0,
    mappedData: {
      roll_no: rollNo,
      full_name: fullName,
      email: email.toLowerCase(),
      admission_year: admissionYear,
      section_id: sectionId,
      lab_group_id: labGroupId,
    },
    errors,
  };
}

/**
 * Validate and map a faculty record against the database cache.
 */
export function validateFacultyRow(
  rawRow: Record<string, string>,
  rowNumber: number,
  mapping: Record<string, string>,
  cache: InstitutionalCache,
  context: ImportContext,
  seenCodes: Set<string>,
  seenEmails: Set<string>,
): { isValid: boolean; mappedData: any; errors: string[] } {
  const errors: string[] = [];
  const mapped: Record<string, string> = {};

  for (const [sourceHeader, canonicalField] of Object.entries(mapping)) {
    if (canonicalField && rawRow[sourceHeader] !== undefined) {
      mapped[canonicalField] = rawRow[sourceHeader].trim();
    }
  }

  // 1. Employee Code
  const empCode = mapped.employee_code || "";
  if (!empCode) {
    errors.push("Employee code is required");
  } else {
    const codeLower = empCode.toLowerCase();
    if (seenCodes.has(codeLower)) {
      errors.push(`Duplicate employee code '${empCode}' within uploaded file`);
    } else {
      seenCodes.add(codeLower);
    }
    if (cache.existingFacultyCodes.has(codeLower)) {
      errors.push(`Employee code '${empCode}' already exists in database`);
    }
  }

  // 2. Full Name
  const fullName = mapped.full_name || "";
  if (!fullName) {
    errors.push("Full name is required");
  }

  // 3. Email
  const email = mapped.email || "";
  if (!email) {
    errors.push("Email is required");
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push(`Invalid email format '${email}'`);
  } else {
    const emailLower = email.toLowerCase();
    if (seenEmails.has(emailLower)) {
      errors.push(`Duplicate email '${email}' within uploaded file`);
    } else {
      seenEmails.add(emailLower);
    }
    if (cache.existingEmails.has(emailLower)) {
      errors.push(`Email '${email}' is already registered in the system`);
    }
  }

  // 4. Department
  let departmentId: number | undefined = context.departmentId;
  const rawDept = mapped.department || "";
  if (rawDept) {
    const deptQuery = rawDept.toLowerCase();
    const matchedDept = cache.departments.find(
      (d) => d.code.toLowerCase() === deptQuery || d.name.toLowerCase() === deptQuery,
    );
    if (!matchedDept) {
      errors.push(`Department '${rawDept}' not found in college`);
    } else if (context.departmentId && matchedDept.id !== context.departmentId) {
      errors.push(`Department '${rawDept}' violates your authorized department scope`);
    } else {
      departmentId = matchedDept.id;
    }
  } else if (!departmentId) {
    errors.push("Department is required");
  }

  // 5. Designation (optional)
  const designation = mapped.designation || null;

  return {
    isValid: errors.length === 0,
    mappedData: {
      employee_code: empCode,
      full_name: fullName,
      email: email.toLowerCase(),
      department_id: departmentId,
      designation,
    },
    errors,
  };
}

export interface MarksCache {
  assignment: any;
  maxMarks: number;
  eligibleStudents: Map<string, { studentId: number; rawRollNo: string; fullName: string }>;
  existingMarks: Map<string, number>;
}

export interface AttendanceCache {
  session: any;
  eligibleStudents: Map<string, { studentId: number; rawRollNo: string; fullName: string }>;
  existingAttendance: Map<string, string>;
}

/**
 * Load context for marks import & template generation.
 */
export async function loadMarksContext(
  collegeId: number,
  assignmentId: number,
  component: "IT1" | "IT2" | "IT3" | "ASSIGNMENT",
  userId?: number,
  userRole?: string,
): Promise<MarksCache> {
  const assignRes = await pool.query(
    `SELECT sa.id, sa.subject_id, sa.faculty_id, sa.section_id, sa.lab_group_id, sa.term_id,
            su.code AS subject_code, su.name AS subject_name, su.subject_type, su.is_elective,
            su.max_it_marks, su.max_assignment_marks,
            f.user_id AS faculty_user_id, f.full_name AS faculty_name,
            sec.name AS section_name,
            lg.name AS lab_group_name
       FROM subject_assignment sa
       JOIN subject su        ON su.id = sa.subject_id
       JOIN faculty f         ON f.id = sa.faculty_id
       JOIN section sec       ON sec.id = sa.section_id
       LEFT JOIN lab_group lg ON lg.id = sa.lab_group_id
       JOIN department d      ON d.id = su.department_id
      WHERE sa.id = $1 AND d.college_id = $2`,
    [assignmentId, collegeId],
  );

  if (assignRes.rows.length === 0) {
    throw Object.assign(new Error("Subject assignment not found"), { status: 404 });
  }

  const assignment = assignRes.rows[0];

  if (userRole === "faculty" && userId && assignment.faculty_user_id !== userId) {
    throw Object.assign(
      new Error("Forbidden: You can only import marks for your own assigned subjects"),
      { status: 403 },
    );
  }

  const maxMarks =
    component === "ASSIGNMENT"
      ? Number(assignment.max_assignment_marks)
      : Number(assignment.max_it_marks);

  const studentsRes = await pool.query(
    `SELECT s.id AS student_id, LOWER(s.roll_no) AS roll_lower, s.roll_no AS raw_roll_no, s.full_name
       FROM student s
      WHERE s.section_id = $1
        AND ($2::bigint IS NULL OR s.lab_group_id = $2)
        AND (
          $3::boolean = false
          OR EXISTS (
            SELECT 1 FROM elective_enrollment ee
             WHERE ee.student_id = s.id
               AND ee.subject_id = $4
               AND ee.term_id = $5
          )
        )
      ORDER BY s.roll_no ASC`,
    [
      assignment.section_id,
      assignment.lab_group_id ?? null,
      assignment.is_elective,
      assignment.subject_id,
      assignment.term_id,
    ],
  );

  const existingMarksRes = await pool.query(
    `SELECT m.student_id, LOWER(s.roll_no) AS roll_lower, m.marks_obtained
       FROM marks m
       JOIN student s ON s.id = m.student_id
      WHERE m.subject_assignment_id = $1 AND m.component = $2`,
    [assignmentId, component],
  );

  const eligibleStudents = new Map<string, { studentId: number; rawRollNo: string; fullName: string }>();
  for (const s of studentsRes.rows) {
    eligibleStudents.set(s.roll_lower, {
      studentId: Number(s.student_id),
      rawRollNo: s.raw_roll_no,
      fullName: s.full_name,
    });
  }

  const existingMarks = new Map<string, number>();
  for (const m of existingMarksRes.rows) {
    existingMarks.set(m.roll_lower, Number(m.marks_obtained));
  }

  return {
    assignment,
    maxMarks,
    eligibleStudents,
    existingMarks,
  };
}

/**
 * Validate and map a marks row against the marks cache.
 */
export function validateMarksRow(
  rawRow: Record<string, string>,
  rowNumber: number,
  mapping: Record<string, string>,
  cache: MarksCache,
  component: string,
  seenRolls: Set<string>,
): { isValid: boolean; mappedData: any; errors: string[] } {
  const errors: string[] = [];
  const mapped: Record<string, string> = {};

  for (const [sourceHeader, canonicalField] of Object.entries(mapping)) {
    if (canonicalField && rawRow[sourceHeader] !== undefined) {
      mapped[canonicalField] = rawRow[sourceHeader].trim();
    }
  }

  const rollNo = mapped.roll_no || "";
  let studentId: number | null = null;
  let fullName = mapped.student_name || "";

  if (!rollNo) {
    errors.push("Roll number is required");
  } else {
    const rollLower = rollNo.toLowerCase();
    if (seenRolls.has(rollLower)) {
      errors.push(`Duplicate roll number '${rollNo}' within uploaded file`);
    } else {
      seenRolls.add(rollLower);
    }

    const eligible = cache.eligibleStudents.get(rollLower);
    if (!eligible) {
      errors.push(`Student with roll number '${rollNo}' is not eligible for this subject assignment`);
    } else {
      studentId = eligible.studentId;
      if (!fullName) fullName = eligible.fullName;

      if (cache.existingMarks.has(rollLower)) {
        const existingScore = cache.existingMarks.get(rollLower);
        errors.push(
          `Marks for ${component} already entered for student ${rollNo} (${existingScore}). Overwrites are not allowed.`,
        );
      }
    }
  }

  const rawMarks = mapped.marks;
  let parsedMarks: number | null = null;
  if (rawMarks === undefined || rawMarks === null || rawMarks === "") {
    errors.push("Marks is required");
  } else {
    const num = Number(rawMarks);
    if (isNaN(num) || num < 0 || num > cache.maxMarks) {
      errors.push(`Marks must be a valid number between 0 and ${cache.maxMarks} for ${component}`);
    } else {
      parsedMarks = num;
    }
  }

  return {
    isValid: errors.length === 0,
    mappedData: {
      student_id: studentId,
      roll_no: rollNo,
      student_name: fullName,
      marks: parsedMarks,
      marks_obtained: parsedMarks,
    },
    errors,
  };
}

/**
 * Load context for attendance import & template generation.
 */
export async function loadAttendanceContext(
  collegeId: number,
  sessionId: number,
  userId?: number,
  userRole?: string,
): Promise<AttendanceCache> {
  const sessionRes = await pool.query(
    `SELECT ls.id, ls.session_date, ls.status, ls.is_locked,
            ts.period_no, ts.start_time, ts.end_time,
            sa.id AS subject_assignment_id, sa.faculty_id, sa.term_id,
            sa.section_id, sec.name AS section_name,
            sa.lab_group_id, lg.name AS lab_group_name,
            su.id AS subject_id, su.code AS subject_code, su.name AS subject_name,
            su.subject_type, su.is_elective,
            f.user_id AS faculty_user_id, f.full_name AS faculty_name
       FROM lecture_session ls
       JOIN timetable_slot ts     ON ts.id = ls.timetable_slot_id
       JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
       JOIN subject su            ON su.id = sa.subject_id
       JOIN faculty f             ON f.id = ts.faculty_id
       JOIN section sec           ON sec.id = sa.section_id
       LEFT JOIN lab_group lg     ON lg.id = sa.lab_group_id
       JOIN department d          ON d.id = su.department_id
      WHERE ls.id = $1 AND d.college_id = $2`,
    [sessionId, collegeId],
  );

  if (sessionRes.rows.length === 0) {
    throw Object.assign(new Error("Lecture session not found"), { status: 404 });
  }

  const session = sessionRes.rows[0];

  if (userRole === "faculty" && userId && session.faculty_user_id !== userId) {
    throw Object.assign(
      new Error("Forbidden: You can only import attendance for your own lecture sessions"),
      { status: 403 },
    );
  }

  if (session.is_locked) {
    throw Object.assign(
      new Error(`Attendance for lecture ${sessionId} is locked and cannot be changed`),
      { status: 409 },
    );
  }

  if (session.status === "cancelled") {
    throw Object.assign(
      new Error("Cannot mark attendance for a cancelled lecture"),
      { status: 422 },
    );
  }

  const studentsRes = await pool.query(
    `SELECT s.id AS student_id, LOWER(s.roll_no) AS roll_lower, s.roll_no AS raw_roll_no, s.full_name
       FROM student s
      WHERE s.section_id = $1
        AND ($2::bigint IS NULL OR s.lab_group_id = $2)
        AND (
          $3::boolean = false
          OR EXISTS (
            SELECT 1 FROM elective_enrollment ee
             WHERE ee.student_id = s.id
               AND ee.subject_id = $4
               AND ee.term_id = $5
          )
        )
      ORDER BY s.roll_no ASC`,
    [
      session.section_id,
      session.lab_group_id ?? null,
      session.is_elective,
      session.subject_id,
      session.term_id,
    ],
  );

  const existingAttRes = await pool.query(
    `SELECT a.student_id, LOWER(s.roll_no) AS roll_lower, a.status
       FROM attendance a
       JOIN student s ON s.id = a.student_id
      WHERE a.lecture_session_id = $1`,
    [sessionId],
  );

  const eligibleStudents = new Map<string, { studentId: number; rawRollNo: string; fullName: string }>();
  for (const s of studentsRes.rows) {
    eligibleStudents.set(s.roll_lower, {
      studentId: Number(s.student_id),
      rawRollNo: s.raw_roll_no,
      fullName: s.full_name,
    });
  }

  const existingAttendance = new Map<string, string>();
  for (const a of existingAttRes.rows) {
    existingAttendance.set(a.roll_lower, a.status);
  }

  return {
    session,
    eligibleStudents,
    existingAttendance,
  };
}

/**
 * Validate and map an attendance row against the attendance cache.
 */
export function validateAttendanceRow(
  rawRow: Record<string, string>,
  rowNumber: number,
  mapping: Record<string, string>,
  cache: AttendanceCache,
  seenRolls: Set<string>,
): { isValid: boolean; mappedData: any; errors: string[] } {
  const errors: string[] = [];
  const mapped: Record<string, string> = {};

  for (const [sourceHeader, canonicalField] of Object.entries(mapping)) {
    if (canonicalField && rawRow[sourceHeader] !== undefined) {
      mapped[canonicalField] = rawRow[sourceHeader].trim();
    }
  }

  const rollNo = mapped.roll_no || "";
  let studentId: number | null = null;
  let fullName = mapped.student_name || "";

  if (!rollNo) {
    errors.push("Roll number is required");
  } else {
    const rollLower = rollNo.toLowerCase();
    if (seenRolls.has(rollLower)) {
      errors.push(`Duplicate roll number '${rollNo}' within uploaded file`);
    } else {
      seenRolls.add(rollLower);
    }

    const eligible = cache.eligibleStudents.get(rollLower);
    if (!eligible) {
      errors.push(`Student with roll number '${rollNo}' is not eligible for this lecture session`);
    } else {
      studentId = eligible.studentId;
      if (!fullName) fullName = eligible.fullName;

      if (cache.existingAttendance.has(rollLower)) {
        const existingStatus = cache.existingAttendance.get(rollLower);
        errors.push(
          `Attendance already recorded as '${existingStatus}' for student ${rollNo}. Overwrites are not allowed.`,
        );
      }
    }
  }

  const rawStatus = mapped.status;
  let normalizedStatus: "present" | "absent" | null = null;
  if (!rawStatus) {
    errors.push("Attendance status is required");
  } else {
    const s = rawStatus.toLowerCase();
    if (s === "p" || s === "present" || s === "1") {
      normalizedStatus = "present";
    } else if (s === "a" || s === "absent" || s === "0") {
      normalizedStatus = "absent";
    } else {
      errors.push(`Invalid attendance status '${rawStatus}'. Must be Present (P) or Absent (A)`);
    }
  }

  return {
    isValid: errors.length === 0,
    mappedData: {
      student_id: studentId,
      roll_no: rollNo,
      student_name: fullName,
      status: normalizedStatus,
    },
    errors,
  };
}

/**
 * Generate a pre-filled marks CSV template for all eligible students.
 */
export async function generateMarksTemplate(
  collegeId: number,
  assignmentId: number,
  component: "IT1" | "IT2" | "IT3" | "ASSIGNMENT",
  userId?: number,
  userRole?: string,
): Promise<{ csv: string; filename: string }> {
  const cache = await loadMarksContext(collegeId, assignmentId, component, userId, userRole);
  const headers = ["Roll Number", "Student Name", "Marks"];
  const rows: Array<(string | number)[]> = [];
  for (const stud of cache.eligibleStudents.values()) {
    rows.push([stud.rawRollNo, stud.fullName, ""]);
  }
  const cleanSubjectCode = (cache.assignment.subject_code || "subject").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `marks_template_${cleanSubjectCode}_${component}.csv`;
  const csv = serializeToCsv(headers, rows);
  return { csv, filename };
}

/**
 * Generate a pre-filled attendance CSV template for all eligible students.
 */
export async function generateAttendanceTemplate(
  collegeId: number,
  sessionId: number,
  userId?: number,
  userRole?: string,
): Promise<{ csv: string; filename: string }> {
  const cache = await loadAttendanceContext(collegeId, sessionId, userId, userRole);
  const headers = ["Roll Number", "Student Name", "Attendance Status"];
  const rows: Array<(string | number)[]> = [];
  for (const stud of cache.eligibleStudents.values()) {
    rows.push([stud.rawRollNo, stud.fullName, ""]);
  }
  const dateStr = cache.session.session_date
    ? new Date(cache.session.session_date).toISOString().split("T")[0]
    : "session";
  const filename = `attendance_template_${dateStr}_period_${cache.session.period_no || sessionId}.csv`;
  const csv = serializeToCsv(headers, rows);
  return { csv, filename };
}

export interface TimetableSlotItem {
  id?: number;
  term_id: number;
  day_of_week: number;
  period_no: number;
  start_time: string;
  end_time: string;
  room: string;
  faculty_id: number;
  section_id: number;
  lab_group_id: number | null;
  faculty_name: string;
  subject_code: string;
  section_name: string;
  lab_group_name: string | null;
}

export interface TimetableCache {
  collegeId: number;
  departmentId: number;
  departmentName: string;
  departmentCode: string;
  currentTerm: {
    id: number;
    academic_year: string;
    term_type: string;
    is_current: boolean;
  };
  terms: Array<{
    id: number;
    academic_year: string;
    term_type: string;
    is_current: boolean;
  }>;
  subjects: Array<{
    id: number;
    code: string;
    name: string;
    subject_type: "theory" | "lab";
    is_elective: boolean;
    department_id: number;
  }>;
  faculty: Array<{
    id: number;
    employee_code: string;
    full_name: string;
    email: string;
    department_id: number;
  }>;
  sections: Array<{
    id: number;
    name: string;
    batch_id: number;
    department_id: number;
  }>;
  labGroups: Array<{
    id: number;
    section_id: number;
    name: string;
  }>;
  existingSlots: TimetableSlotItem[];
}

const DAY_MAP: Record<string, number> = {
  "1": 1, "monday": 1, "mon": 1,
  "2": 2, "tuesday": 2, "tue": 2, "tues": 2,
  "3": 3, "wednesday": 3, "wed": 3,
  "4": 4, "thursday": 4, "thu": 4, "thur": 4, "thurs": 4,
  "5": 5, "friday": 5, "fri": 5,
  "6": 6, "saturday": 6, "sat": 6,
  "7": 7, "sunday": 7, "sun": 7,
};

const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "09:00", end: "10:00" },
  2: { start: "10:00", end: "11:00" },
  3: { start: "11:15", end: "12:15" },
  4: { start: "12:15", end: "13:15" },
  5: { start: "14:00", end: "15:00" },
  6: { start: "15:00", end: "16:00" },
};

export async function loadTimetableContext(
  collegeId: number,
  departmentId?: number,
  termId?: number,
): Promise<TimetableCache> {
  if (!departmentId) {
    throw Object.assign(new Error("department_id is required for timetable import"), { status: 400 });
  }

  const deptRes = await pool.query(
    `SELECT id, name, code FROM department WHERE id = $1 AND college_id = $2`,
    [departmentId, collegeId],
  );
  if (deptRes.rows.length === 0) {
    throw Object.assign(new Error("Department not found in this college"), { status: 404 });
  }
  const dept = deptRes.rows[0];

  const termsRes = await pool.query(
    `SELECT id, academic_year, term_type, is_current
       FROM academic_term
      WHERE college_id = $1
      ORDER BY is_current DESC, start_date DESC`,
    [collegeId],
  );
  if (termsRes.rows.length === 0) {
    throw Object.assign(new Error("No academic terms configured for this college"), { status: 404 });
  }

  const terms = termsRes.rows;
  const currentTerm = termId
    ? terms.find((t) => t.id === termId) || terms[0]
    : terms.find((t) => t.is_current) || terms[0];

  const subjectsRes = await pool.query(
    `SELECT id, code, name, subject_type, is_elective, department_id
       FROM subject
      WHERE department_id = $1`,
    [departmentId],
  );

  const facultyRes = await pool.query(
    `SELECT f.id, f.employee_code, f.full_name, u.email, f.department_id
       FROM faculty f
       JOIN app_user u ON u.id = f.user_id
      WHERE u.college_id = $1`,
    [collegeId],
  );

  const sectionsRes = await pool.query(
    `SELECT s.id, s.name, s.batch_id, p.department_id
       FROM section s
       JOIN batch b   ON b.id = s.batch_id
       JOIN program p ON p.id = b.program_id
      WHERE p.department_id = $1`,
    [departmentId],
  );

  const sectionIds = sectionsRes.rows.map((s) => s.id);
  let labGroups: any[] = [];
  if (sectionIds.length > 0) {
    const lgRes = await pool.query(
      `SELECT lg.id, lg.section_id, lg.name
         FROM lab_group lg
        WHERE lg.section_id = ANY($1::bigint[])`,
      [sectionIds],
    );
    labGroups = lgRes.rows;
  }

  const slotsRes = await pool.query(
    `SELECT ts.id, ts.term_id, ts.day_of_week, ts.period_no, ts.start_time, ts.end_time, ts.room,
            ts.faculty_id, sa.section_id, sa.lab_group_id,
            f.full_name AS faculty_name,
            su.code AS subject_code,
            sec.name AS section_name,
            lg.name AS lab_group_name
       FROM timetable_slot ts
       JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
       JOIN subject su            ON su.id = sa.subject_id
       JOIN faculty f             ON f.id = ts.faculty_id
       JOIN section sec           ON sec.id = sa.section_id
       LEFT JOIN lab_group lg     ON lg.id = sa.lab_group_id
      WHERE ts.term_id = $1`,
    [currentTerm.id],
  );

  const existingSlots: TimetableSlotItem[] = slotsRes.rows.map((r) => ({
    id: r.id,
    term_id: r.term_id,
    day_of_week: r.day_of_week,
    period_no: r.period_no,
    start_time: String(r.start_time).slice(0, 5),
    end_time: String(r.end_time).slice(0, 5),
    room: r.room,
    faculty_id: Number(r.faculty_id),
    section_id: Number(r.section_id),
    lab_group_id: r.lab_group_id ? Number(r.lab_group_id) : null,
    faculty_name: r.faculty_name,
    subject_code: r.subject_code,
    section_name: r.section_name,
    lab_group_name: r.lab_group_name || null,
  }));

  return {
    collegeId,
    departmentId,
    departmentName: dept.name,
    departmentCode: dept.code,
    currentTerm,
    terms,
    subjects: subjectsRes.rows,
    faculty: facultyRes.rows,
    sections: sectionsRes.rows,
    labGroups,
    existingSlots,
  };
}

export function validateTimetableRow(
  rawRow: Record<string, string>,
  rowNumber: number,
  mapping: Record<string, string>,
  cache: TimetableCache,
  batchSlots: TimetableSlotItem[],
  seenSlotKeys: Set<string>,
): { isValid: boolean; mappedData: any; errors: string[] } {
  const errors: string[] = [];

  const getVal = (canonicalKey: string): string => {
    for (const [csvCol, mappedKey] of Object.entries(mapping)) {
      if (mappedKey === canonicalKey && rawRow[csvCol] !== undefined) {
        return String(rawRow[csvCol]).trim();
      }
    }
    return "";
  };

  const subjectCode = getVal("subject_code").toUpperCase();
  const facultyCode = getVal("faculty_code");
  const sectionName = getVal("section");
  const labGroupName = getVal("lab_group");
  const dayVal = getVal("day_of_week");
  const periodVal = getVal("period_no");
  const startTimeVal = getVal("start_time");
  const endTimeVal = getVal("end_time");
  const roomVal = getVal("room");
  const termVal = getVal("academic_term");

  if (!subjectCode) errors.push("Subject Code is required");
  if (!facultyCode) errors.push("Faculty Employee Code is required");
  if (!sectionName) errors.push("Section is required");
  if (!dayVal) errors.push("Day of Week is required");
  if (!roomVal) errors.push("Room is required");

  // 1. Resolve Subject
  const subject = cache.subjects.find((s) => s.code.toUpperCase() === subjectCode);
  if (subjectCode && !subject) {
    errors.push(`Subject '${subjectCode}' does not belong to department ${cache.departmentCode}`);
  }

  // 2. Resolve Lab Group constraint
  if (subject && subject.subject_type === "lab" && !labGroupName) {
    errors.push(`Subject '${subjectCode}' is a laboratory course and requires a valid Lab Group (e.g. A1, A2)`);
  }

  // 3. Resolve Faculty
  const faculty = cache.faculty.find(
    (f) =>
      f.employee_code.toUpperCase() === facultyCode.toUpperCase() ||
      f.email.toLowerCase() === facultyCode.toLowerCase() ||
      f.full_name.toLowerCase() === facultyCode.toLowerCase(),
  );
  if (facultyCode && !faculty) {
    errors.push(`Faculty member with code/name '${facultyCode}' not found`);
  } else if (faculty && faculty.department_id !== cache.departmentId) {
    errors.push(`Faculty member '${faculty.full_name}' (${faculty.employee_code}) belongs to another department`);
  }

  // 4. Resolve Section
  const section = cache.sections.find((sec) => sec.name.toLowerCase() === sectionName.toLowerCase());
  if (sectionName && !section) {
    errors.push(`Section '${sectionName}' not found in department programs`);
  }

  // 5. Resolve Lab Group
  let labGroup: any = null;
  if (labGroupName && section) {
    labGroup = cache.labGroups.find(
      (lg) => lg.section_id === section.id && lg.name.toLowerCase() === labGroupName.toLowerCase(),
    );
    if (!labGroup) {
      errors.push(`Lab Group '${labGroupName}' does not belong to Section '${section.name}'`);
    }
  }

  // 6. Resolve Term
  let term = cache.currentTerm;
  if (termVal) {
    const matchedTerm = cache.terms.find(
      (t) =>
        t.academic_year.toLowerCase() === termVal.toLowerCase() ||
        termVal.toLowerCase().replace(/^ay\s*/i, "").trim() === t.academic_year.toLowerCase() ||
        `${t.academic_year}-${t.term_type}`.toLowerCase() === termVal.toLowerCase() ||
        `${t.academic_year} ${t.term_type}`.toLowerCase() === termVal.toLowerCase() ||
        `AY ${t.academic_year} ${t.term_type}`.toLowerCase().replace(/\s+/g, "") === termVal.toLowerCase().replace(/\s+/g, "") ||
        String(t.id) === termVal,
    );
    if (matchedTerm) {
      term = matchedTerm;
    } else {
      errors.push(`Academic Term '${termVal}' not recognized in this college`);
    }
  }

  // 7. Resolve Day
  const dayNum = DAY_MAP[dayVal.toLowerCase()];
  if (dayVal && (!dayNum || dayNum < 1 || dayNum > 7)) {
    errors.push(`Invalid Day of Week '${dayVal}'. Use Monday-Saturday or 1-6`);
  }

  // 8. Resolve Period and Times
  let periodNo = periodVal ? parseInt(periodVal, 10) : undefined;
  let startTime = startTimeVal;
  let endTime = endTimeVal;

  if (periodNo && (isNaN(periodNo) || periodNo < 1 || periodNo > 6)) {
    errors.push(`Period number must be between 1 and 6 (got ${periodVal})`);
  }

  if (periodNo && PERIOD_TIMES[periodNo]) {
    if (!startTime) startTime = PERIOD_TIMES[periodNo].start;
    if (!endTime) endTime = PERIOD_TIMES[periodNo].end;
  }

  if (!periodNo && startTime) {
    for (const [pStr, times] of Object.entries(PERIOD_TIMES)) {
      if (times.start === startTime.slice(0, 5)) {
        periodNo = Number(pStr);
        if (!endTime) endTime = times.end;
        break;
      }
    }
  }

  if (!periodNo) {
    errors.push("Period number (1-6) could not be determined. Please specify Period or valid Start Time");
  }

  if (!startTime || !endTime) {
    errors.push("Start and End times could not be determined for this period");
  } else if (startTime.slice(0, 5) >= endTime.slice(0, 5)) {
    errors.push(`Start time (${startTime}) must be strictly before end time (${endTime})`);
  }

  const normStartTime = startTime ? startTime.slice(0, 5) : "";
  const normEndTime = endTime ? endTime.slice(0, 5) : "";

  // 9. Deduplication check in batch
  const dedupeKey = `${term.id}_${dayNum}_${periodNo || normStartTime}_${subject?.id}_${section?.id}_${labGroup?.id || "whole"}`;
  if (seenSlotKeys.has(dedupeKey)) {
    errors.push(`Duplicate slot: ${subjectCode} for Section ${sectionName} is repeated on day ${dayNum} period ${periodNo || normStartTime}`);
  } else {
    seenSlotKeys.add(dedupeKey);
  }

  // 10. Clash detection against existing DB slots and previous valid rows in this batch!
  if (errors.length === 0 && dayNum && faculty && section) {
    const allSlotsToCheck = [...cache.existingSlots, ...batchSlots];

    for (const other of allSlotsToCheck) {
      if (other.term_id !== term.id || other.day_of_week !== dayNum) continue;

      // Check time overlap: startA < endB && endA > startB
      const overlaps = normStartTime < other.end_time && normEndTime > other.start_time;
      if (!overlaps) continue;

      const otherStart = other.start_time;
      const otherEnd = other.end_time;

      // Rule 1: Faculty clash
      if (other.faculty_id === faculty.id) {
        errors.push(`Faculty clash: ${faculty.full_name} is already scheduled in ${other.room} from ${otherStart} to ${otherEnd}`);
        break;
      }

      // Rule 2: Room clash
      if (other.room.trim().toLowerCase() === roomVal.trim().toLowerCase()) {
        errors.push(`Room clash: Room ${other.room} is already occupied by ${other.subject_code} from ${otherStart} to ${otherEnd}`);
        break;
      }

      // Rules 3, 4, 5: Section and Lab Group conflicts
      if (other.section_id === section.id) {
        const otherIsLab = !!other.lab_group_id;
        const targetIsLab = !!labGroup?.id;

        // Rule 3: Whole section vs whole section
        if (!otherIsLab && !targetIsLab) {
          errors.push(`Section clash: Section ${section.name} already has a whole-section lecture (${other.subject_code}) from ${otherStart} to ${otherEnd}`);
          break;
        }

        // Rule 4: Whole section vs lab group
        if ((!otherIsLab && targetIsLab) || (otherIsLab && !targetIsLab)) {
          errors.push(`Section clash: Cannot schedule concurrent whole-section lecture and lab group for Section ${section.name} from ${otherStart} to ${otherEnd}`);
          break;
        }

        // Rule 5: Same lab group
        if (otherIsLab && targetIsLab && other.lab_group_id === labGroup.id) {
          errors.push(`Lab group clash: Lab Group ${labGroupName} already has a session scheduled from ${otherStart} to ${otherEnd}`);
          break;
        }

        // Rule 6: Different lab groups in different rooms with different faculty are permitted!
      }
    }
  }

  const mappedData = {
    subject_id: subject?.id,
    subject_code: subjectCode,
    subject_name: subject?.name,
    subject_type: subject?.subject_type,
    faculty_id: faculty?.id,
    faculty_code: facultyCode,
    faculty_name: faculty?.full_name,
    section_id: section?.id,
    section_name: sectionName,
    lab_group_id: labGroup?.id ?? null,
    lab_group_name: labGroupName || null,
    day_of_week: dayNum,
    period_no: periodNo,
    start_time: normStartTime,
    end_time: normEndTime,
    room: roomVal,
    term_id: term.id,
    academic_term: `${term.academic_year} ${term.term_type}`,
  };

  if (errors.length === 0) {
    batchSlots.push({
      term_id: term.id,
      day_of_week: dayNum!,
      period_no: periodNo!,
      start_time: normStartTime,
      end_time: normEndTime,
      room: roomVal,
      faculty_id: faculty!.id,
      section_id: section!.id,
      lab_group_id: labGroup ? labGroup.id : null,
      faculty_name: faculty!.full_name,
      subject_code: subjectCode,
      section_name: sectionName,
      lab_group_name: labGroupName || null,
    });
  }

  return {
    isValid: errors.length === 0,
    mappedData,
    errors,
  };
}

export async function generateTimetableTemplate(
  collegeId: number,
  departmentId?: number,
  termId?: number,
): Promise<{ csv: string; filename: string }> {
  let cache: TimetableCache | null = null;
  if (departmentId) {
    try {
      cache = await loadTimetableContext(collegeId, departmentId, termId);
    } catch {}
  }

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

  const rows: string[][] = [];

  if (cache && cache.subjects.length > 0) {
    const theorySubjects = cache.subjects.filter((s) => s.subject_type === "theory");
    const labSubjects = cache.subjects.filter((s) => s.subject_type === "lab");
    const sampleSec = cache.sections.find((s) => s.name.toUpperCase() === "B")?.name || cache.sections[0]?.name || "A";
    const sampleLg1 = cache.labGroups.find((lg) => lg.name.includes("1"))?.name || "B1";
    const sampleLg2 = cache.labGroups.find((lg) => lg.name.includes("2"))?.name || "B2";
    const sampleFac1 = cache.faculty.find((f) => f.department_id === cache!.departmentId)?.employee_code || cache.faculty[0]?.employee_code || "EMP101";
    const sampleFac2 = cache.faculty.filter((f) => f.department_id === cache!.departmentId)[1]?.employee_code || sampleFac1;
    const sampleFac3 = cache.faculty.filter((f) => f.department_id === cache!.departmentId)[2]?.employee_code || sampleFac1;
    const termLabel = `AY ${cache.currentTerm.academic_year} ${cache.currentTerm.term_type}`;

    const sub1 = theorySubjects[0]?.code || cache.subjects[0]?.code || "CO501";
    rows.push([sub1, sampleFac1, sampleSec, "", "Wednesday", "4", "12:15", "13:15", "LH-102", termLabel]);

    const sub2 = theorySubjects[1]?.code || theorySubjects[0]?.code || "CO502";
    rows.push([sub2, sampleFac2, sampleSec, "", "Wednesday", "5", "14:00", "15:00", "LH-102", termLabel]);

    if (labSubjects.length > 0) {
      const labSub = labSubjects[0]?.code || "CO503";
      rows.push([labSub, sampleFac1, sampleSec, sampleLg1, "Friday", "5", "14:00", "15:00", "Lab 1", termLabel]);
      rows.push([labSub, sampleFac3, sampleSec, sampleLg2, "Friday", "5", "14:00", "15:00", "Lab 2", termLabel]);
    }
  } else {
    rows.push(["CO501", "EMP101", "A", "", "Wednesday", "4", "12:15", "13:15", "LH-102", "AY 2026-27 Even"]);
    rows.push(["CO502", "EMP102", "A", "", "Wednesday", "5", "14:00", "15:00", "LH-102", "AY 2026-27 Even"]);
    rows.push(["CO503", "EMP101", "A", "A1", "Friday", "5", "14:00", "15:00", "Lab 1", "AY 2026-27 Even"]);
    rows.push(["CO503", "EMP103", "A", "A2", "Friday", "5", "14:00", "15:00", "Lab 2", "AY 2026-27 Even"]);
  }

  const deptCode = cache?.departmentCode || "timetable";
  const filename = `${deptCode.toLowerCase()}_timetable_template.csv`;
  const csv = serializeToCsv(headers, rows);
  return { csv, filename };
}

function verifyContextBelongsToCollege(context: ImportContext, cache: InstitutionalCache): void {
  if (context.departmentId && !cache.departments.some((d) => d.id === context.departmentId)) {
    throw Object.assign(new Error("Selected department does not exist in this college"), { status: 403 });
  }
  if (context.sectionId && !cache.sections.some((s) => s.id === context.sectionId)) {
    throw Object.assign(new Error("Selected section does not exist in this college"), { status: 403 });
  }
  if (context.batchId && !cache.batches.some((b) => b.id === context.batchId)) {
    throw Object.assign(new Error("Selected batch does not exist in this college"), { status: 403 });
  }
  if (context.programId && !cache.programs.some((p) => p.id === context.programId)) {
    throw Object.assign(new Error("Selected program does not exist in this college"), { status: 403 });
  }
}

/**
 * Preview uploaded CSV: parses content, detects mappings, and validates rows without modifying DB.
 */
export async function previewCsv(
  collegeId: number,
  fileBuffer: Buffer,
  entityType: EntityType,
  submittedMappings?: Record<string, string>,
  context: ImportContext = {},
): Promise<PreviewResult> {
  const { headers, rows, totalRows } = parseCsv(fileBuffer);

  const suggestedMappings = detectHeaderMappings(headers, entityType);
  const effectiveMappings = submittedMappings && Object.keys(submittedMappings).length > 0
    ? submittedMappings
    : suggestedMappings;

  let instCache: InstitutionalCache | null = null;
  let marksCache: MarksCache | null = null;
  let attendanceCache: AttendanceCache | null = null;
  let timetableCache: TimetableCache | null = null;

  if (entityType === "student" || entityType === "faculty") {
    instCache = await loadInstitutionalCache(collegeId);
    verifyContextBelongsToCollege(context, instCache);
  } else if (entityType === "marks") {
    if (!context.assignmentId || !context.component) {
      throw Object.assign(new Error("assignment_id and component are required for marks import"), { status: 400 });
    }
    marksCache = await loadMarksContext(collegeId, context.assignmentId, context.component, context.userId, context.userRole);
  } else if (entityType === "attendance") {
    if (!context.sessionId) {
      throw Object.assign(new Error("session_id is required for attendance import"), { status: 400 });
    }
    attendanceCache = await loadAttendanceContext(collegeId, context.sessionId, context.userId, context.userRole);
  } else if (entityType === "timetable") {
    if (!context.departmentId) {
      throw Object.assign(new Error("department_id is required for timetable import"), { status: 400 });
    }
    timetableCache = await loadTimetableContext(collegeId, context.departmentId, context.termId);
  }

  const seenKeys = new Set<string>();
  const seenEmails = new Set<string>();
  const batchSlots: TimetableSlotItem[] = [];
  const previewRows: RowPreview[] = [];
  const allErrors: RowError[] = [];
  let validRowCount = 0;
  let invalidRowCount = 0;

  rows.forEach((rawRow: Record<string, string>, idx: number) => {
    const rowNumber = idx + 2; // Row 1 is header
    let validation: { isValid: boolean; mappedData: any; errors: string[] };

    if (entityType === "student") {
      validation = validateStudentRow(rawRow, rowNumber, effectiveMappings, instCache!, context, seenKeys, seenEmails);
    } else if (entityType === "faculty") {
      validation = validateFacultyRow(rawRow, rowNumber, effectiveMappings, instCache!, context, seenKeys, seenEmails);
    } else if (entityType === "marks") {
      validation = validateMarksRow(rawRow, rowNumber, effectiveMappings, marksCache!, context.component!, seenKeys);
    } else if (entityType === "attendance") {
      validation = validateAttendanceRow(rawRow, rowNumber, effectiveMappings, attendanceCache!, seenKeys);
    } else {
      validation = validateTimetableRow(rawRow, rowNumber, effectiveMappings, timetableCache!, batchSlots, seenKeys);
    }

    if (validation.isValid) {
      validRowCount++;
    } else {
      invalidRowCount++;
      validation.errors.forEach((err) => {
        allErrors.push({
          rowNumber,
          identifier:
            validation.mappedData.roll_no ||
            validation.mappedData.employee_code ||
            validation.mappedData.subject_code ||
            undefined,
          error: err,
        });
      });
    }

    // Keep first 10 rows for table preview
    if (idx < 10) {
      previewRows.push({
        rowNumber,
        raw: rawRow,
        mapped: validation.mappedData,
        isValid: validation.isValid,
        errors: validation.errors,
      });
    }
  });

  return {
    headers,
    suggestedMappings: effectiveMappings,
    canonicalFields: getCanonicalFields(entityType).map((f: any) => ({
      key: f.key,
      label: f.label,
      required: f.required,
      description: f.description,
    })),
    totalRows,
    validRowCount,
    invalidRowCount,
    previewRows,
    errors: allErrors,
  };
}

/**
 * Execute transactional bulk import.
 * Reparses the uploaded file, revalidates every record, and inserts inside a single transaction.
 */
export async function executeImport(
  collegeId: number,
  fileBuffer: Buffer,
  entityType: EntityType,
  mappings: Record<string, string>,
  context: ImportContext = {},
): Promise<ExecuteResult> {
  const { headers, rows, totalRows } = parseCsv(fileBuffer);

  let instCache: InstitutionalCache | null = null;
  let marksCache: MarksCache | null = null;
  let attendanceCache: AttendanceCache | null = null;
  let timetableCache: TimetableCache | null = null;

  if (entityType === "student" || entityType === "faculty") {
    instCache = await loadInstitutionalCache(collegeId);
    verifyContextBelongsToCollege(context, instCache);
  } else if (entityType === "marks") {
    if (!context.assignmentId || !context.component) {
      throw Object.assign(new Error("assignment_id and component are required for marks import"), { status: 400 });
    }
    marksCache = await loadMarksContext(collegeId, context.assignmentId, context.component, context.userId, context.userRole);
  } else if (entityType === "attendance") {
    if (!context.sessionId) {
      throw Object.assign(new Error("session_id is required for attendance import"), { status: 400 });
    }
    attendanceCache = await loadAttendanceContext(collegeId, context.sessionId, context.userId, context.userRole);
  } else if (entityType === "timetable") {
    if (!context.departmentId) {
      throw Object.assign(new Error("department_id is required for timetable import"), { status: 400 });
    }
    timetableCache = await loadTimetableContext(collegeId, context.departmentId, context.termId);
  }

  const seenKeys = new Set<string>();
  const seenEmails = new Set<string>();
  const batchSlots: TimetableSlotItem[] = [];
  const validRecords: Array<{ rowNumber: number; mapped: any; raw: Record<string, string> }> = [];
  const errors: RowError[] = [];
  const failedRawRows: Array<{ rowNumber: number; raw: Record<string, string>; error: string }> = [];

  rows.forEach((rawRow: Record<string, string>, idx: number) => {
    const rowNumber = idx + 2;
    let validation: { isValid: boolean; mappedData: any; errors: string[] };

    if (entityType === "student") {
      validation = validateStudentRow(rawRow, rowNumber, mappings, instCache!, context, seenKeys, seenEmails);
    } else if (entityType === "faculty") {
      validation = validateFacultyRow(rawRow, rowNumber, mappings, instCache!, context, seenKeys, seenEmails);
    } else if (entityType === "marks") {
      validation = validateMarksRow(rawRow, rowNumber, mappings, marksCache!, context.component!, seenKeys);
    } else if (entityType === "attendance") {
      validation = validateAttendanceRow(rawRow, rowNumber, mappings, attendanceCache!, seenKeys);
    } else {
      validation = validateTimetableRow(rawRow, rowNumber, mappings, timetableCache!, batchSlots, seenKeys);
    }

    if (validation.isValid) {
      validRecords.push({ rowNumber, mapped: validation.mappedData, raw: rawRow });
    } else {
      const errorMsg = validation.errors.join("; ");
      failedRawRows.push({ rowNumber, raw: rawRow, error: errorMsg });
      validation.errors.forEach((err) => {
        errors.push({
          rowNumber,
          identifier:
            validation.mappedData.roll_no ||
            validation.mappedData.employee_code ||
            validation.mappedData.subject_code ||
            undefined,
          error: err,
        });
      });
    }
  });

  // If strict mode is enabled (skipErrors = false) and errors exist, reject entire batch
  if (context.skipErrors === false && errors.length > 0) {
    throw Object.assign(
      new Error(`Import aborted: ${errors.length} validation errors found and skip_errors is disabled`),
      { status: 422, details: errors },
    );
  }

  if (validRecords.length === 0) {
    throw Object.assign(
      new Error("No valid records found to import. Please review CSV errors."),
      { status: 400, details: errors },
    );
  }

  // Transactional insertion
  const client = await pool.connect();
  let importedCount = 0;

  try {
    await client.query("BEGIN");

    if (entityType === "timetable") {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('timetable_import_' || $1))", [collegeId]);
    }

    for (const record of validRecords) {
      if (entityType === "student") {
        const student = record.mapped;
        // Deterministic initial password: Acad@<RollNo>
        const initialPassword = `Acad@${student.roll_no}`;
        const passwordHash = await bcrypt.hash(initialPassword, 10);

        // Find department_id for this section
        const secRes = await client.query(
          `SELECT d.id AS department_id
             FROM section sec
             JOIN batch b ON b.id = sec.batch_id
             JOIN program p ON p.id = b.program_id
             JOIN department d ON d.id = p.department_id
            WHERE sec.id = $1 AND d.college_id = $2`,
          [student.section_id, collegeId],
        );
        const departmentId = secRes.rows[0]?.department_id || null;

        const userRes = await client.query(
          `INSERT INTO app_user (college_id, department_id, email, password_hash, role)
           VALUES ($1, $2, $3, $4, 'student')
           RETURNING id`,
          [collegeId, departmentId, student.email, passwordHash],
        );

        await client.query(
          `INSERT INTO student (user_id, section_id, lab_group_id, roll_no, full_name, admission_year)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userRes.rows[0].id,
            student.section_id,
            student.lab_group_id ?? null,
            student.roll_no,
            student.full_name,
            student.admission_year,
          ],
        );
        importedCount++;
      } else if (entityType === "faculty") {
        const faculty = record.mapped;
        // Deterministic initial password: Staff@<EmployeeCode>
        const initialPassword = `Staff@${faculty.employee_code}`;
        const passwordHash = await bcrypt.hash(initialPassword, 10);

        const userRes = await client.query(
          `INSERT INTO app_user (college_id, department_id, email, password_hash, role)
           VALUES ($1, $2, $3, $4, 'faculty')
           RETURNING id`,
          [collegeId, faculty.department_id, faculty.email, passwordHash],
        );

        await client.query(
          `INSERT INTO faculty (user_id, department_id, employee_code, full_name, designation)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userRes.rows[0].id,
            faculty.department_id,
            faculty.employee_code,
            faculty.full_name,
            faculty.designation ?? null,
          ],
        );
        importedCount++;
      } else if (entityType === "marks") {
        await client.query(
          `INSERT INTO marks (student_id, subject_assignment_id, component, marks_obtained, entered_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, now())`,
          [
            record.mapped.student_id,
            context.assignmentId,
            context.component,
            record.mapped.marks_obtained,
            marksCache!.assignment.faculty_id,
          ],
        );
        importedCount++;
      } else if (entityType === "attendance") {
        await client.query(
          `INSERT INTO attendance (lecture_session_id, student_id, status, marked_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (lecture_session_id, student_id)
           DO UPDATE SET status = EXCLUDED.status, marked_at = now()`,
          [
            context.sessionId,
            record.mapped.student_id,
            record.mapped.status,
          ],
        );
        importedCount++;
      } else if (entityType === "timetable") {
        const item = record.mapped;

        // 1. Resolve or create subject_assignment
        let assignmentId: number;
        const existingAssRes = await client.query(
          `SELECT id FROM subject_assignment
            WHERE subject_id = $1
              AND faculty_id = $2
              AND section_id = $3
              AND lab_group_id IS NOT DISTINCT FROM $4
              AND term_id = $5`,
          [item.subject_id, item.faculty_id, item.section_id, item.lab_group_id, item.term_id],
        );

        if (existingAssRes.rows.length > 0) {
          assignmentId = existingAssRes.rows[0].id;
        } else {
          const newAssRes = await client.query(
            `INSERT INTO subject_assignment (subject_id, faculty_id, section_id, lab_group_id, term_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [item.subject_id, item.faculty_id, item.section_id, item.lab_group_id, item.term_id],
          );
          assignmentId = newAssRes.rows[0].id;
        }

        // 2. Insert timetable slot (Triggers trg_slot_fill and trg_timetable_slot_clash_guard will validate)
        await client.query(
          `INSERT INTO timetable_slot (subject_assignment_id, faculty_id, term_id, day_of_week, period_no, start_time, end_time, room)
           VALUES ($1, $2, $3, $4, $5, $6::time, $7::time, $8)`,
          [
            assignmentId,
            item.faculty_id,
            item.term_id,
            item.day_of_week,
            item.period_no,
            item.start_time,
            item.end_time,
            item.room,
          ],
        );
        importedCount++;
      }
    }

    // If attendance was imported, lock the lecture session and mark as held
    if (entityType === "attendance" && context.sessionId && importedCount > 0) {
      await client.query(
        `UPDATE lecture_session
            SET is_locked = true,
                status = 'held',
                locked_at = now(),
                locked_by = $2
          WHERE id = $1`,
        [context.sessionId, context.userId || null],
      );
    }

    await client.query("COMMIT");
  } catch (err: any) {
    await client.query("ROLLBACK");
    throw Object.assign(
      new Error(`Database error during bulk import: ${err.message || "Transaction rolled back"}`),
      { status: 500 },
    );
  } finally {
    client.release();
  }

  // Generate downloadable error CSV if any rows failed
  let errorCsv: string | undefined;
  if (failedRawRows.length > 0) {
    const errorCsvHeaders = ["Row Number", ...headers, "Import Error"];
    const errorCsvRows = failedRawRows.map((f) => [
      f.rowNumber,
      ...headers.map((h: string) => f.raw[h] ?? ""),
      f.error,
    ]);
    errorCsv = serializeToCsv(errorCsvHeaders, errorCsvRows);
  }

  return {
    totalRows,
    importedCount,
    skippedCount: failedRawRows.length,
    failedCount: failedRawRows.length,
    errors,
    errorCsv,
  };
}
