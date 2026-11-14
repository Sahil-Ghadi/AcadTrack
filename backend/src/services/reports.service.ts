import pool from "../config/db";

// ======================== STUDENT'S OWN REPORT ========================

export async function getStudentOwnReport(userId: number, collegeId: number) {
  // 1. Get student identity
  const stRes = await pool.query(
    `SELECT s.id, s.roll_no, s.full_name, s.admission_year,
            s.section_id, sec.name AS section_name,
            s.lab_group_id, lg.name AS lab_group_name,
            b.start_year, b.end_year, p.name AS program_name,
            d.name AS department_name
       FROM student s
       JOIN app_user u        ON u.id = s.user_id
       JOIN section sec       ON sec.id = s.section_id
       LEFT JOIN lab_group lg ON lg.id = s.lab_group_id
       JOIN batch b           ON b.id = sec.batch_id
       JOIN program p         ON p.id = b.program_id
       JOIN department d      ON d.id = p.department_id
      WHERE s.user_id = $1 AND u.college_id = $2`,
    [userId, collegeId],
  );

  if (stRes.rows.length === 0) return null;
  const student = stRes.rows[0];

  // 2. Query attendance & marks from views: v_attendance_summary & v_marks_summary
  const subjectsRes = await pool.query(
    `SELECT sa.id AS subject_assignment_id,
            su.id AS subject_id, su.code AS subject_code, su.name AS subject_name,
            su.subject_type, su.is_elective, su.max_it_marks, su.max_assignment_marks,
            f.full_name AS faculty_name,
            vas.total_lectures,
            vas.present_count,
            vas.attendance_pct,
            vas.attendance_threshold,
            vas.is_eligible,
            vms.it1,
            vms.it2,
            vms.it3,
            vms.assignment
       FROM subject_assignment sa
       JOIN subject su        ON su.id = sa.subject_id
       JOIN faculty f         ON f.id = sa.faculty_id
       JOIN academic_term t   ON t.id = sa.term_id AND t.is_current = true
       JOIN department d      ON d.id = su.department_id
       LEFT JOIN v_attendance_summary vas
              ON vas.student_id = $1 AND vas.subject_assignment_id = sa.id
       LEFT JOIN v_marks_summary vms
              ON vms.student_id = $1 AND vms.subject_assignment_id = sa.id
      WHERE d.college_id = $2
        AND (sa.section_id = $3)
        AND ($4::bigint IS NULL OR sa.lab_group_id IS NULL OR sa.lab_group_id = $4)
        AND (
          su.is_elective = false
          OR EXISTS (
            SELECT 1 FROM elective_enrollment ee
             WHERE ee.student_id = $1 AND ee.subject_id = su.id AND ee.term_id = sa.term_id
          )
        )
      ORDER BY su.code`,
    [student.id, collegeId, student.section_id, student.lab_group_id],
  );

  return {
    student,
    subjects: subjectsRes.rows,
  };
}

// ======================== SUBJECT ASSIGNMENT REPORT ========================

export async function getAssignmentReport(
  assignmentId: number,
  collegeId: number,
  options?: { belowThresholdOnly?: boolean },
) {
  const assignRes = await pool.query(
    `SELECT sa.id, sa.subject_id, su.code AS subject_code, su.name AS subject_name,
            su.max_it_marks, su.max_assignment_marks,
            sec.name AS section_name, lg.name AS lab_group_name,
            f.full_name AS faculty_name, f.user_id AS faculty_user_id,
            st.attendance_threshold
       FROM subject_assignment sa
       JOIN subject su        ON su.id = sa.subject_id
       JOIN faculty f         ON f.id = sa.faculty_id
       JOIN section sec       ON sec.id = sa.section_id
       LEFT JOIN lab_group lg ON lg.id = sa.lab_group_id
       JOIN department d      ON d.id = su.department_id
       JOIN settings st       ON st.college_id = d.college_id
      WHERE sa.id = $1 AND d.college_id = $2`,
    [assignmentId, collegeId],
  );

  if (assignRes.rows.length === 0) return null;
  const assignment = assignRes.rows[0];

  const studentsRes = await pool.query(
    `SELECT s.id AS student_id, s.roll_no, s.full_name,
            COALESCE(vas.total_lectures, 0) AS total_lectures,
            COALESCE(vas.present_count, 0)  AS present_count,
            COALESCE(vas.attendance_pct, 0) AS attendance_pct,
            COALESCE(vas.is_eligible, false) AS is_eligible,
            vms.it1, vms.it2, vms.it3, vms.assignment
       FROM student s
       LEFT JOIN v_attendance_summary vas
              ON vas.student_id = s.id AND vas.subject_assignment_id = $1
       LEFT JOIN v_marks_summary vms
              ON vms.student_id = s.id AND vms.subject_assignment_id = $1
       JOIN subject_assignment sa ON sa.id = $1
       JOIN subject su            ON su.id = sa.subject_id
      WHERE s.section_id = sa.section_id
        AND (sa.lab_group_id IS NULL OR s.lab_group_id = sa.lab_group_id)
        AND (
          su.is_elective = false
          OR EXISTS (
            SELECT 1 FROM elective_enrollment ee
             WHERE ee.student_id = s.id AND ee.subject_id = su.id AND ee.term_id = sa.term_id
          )
        )
        AND ($2::boolean IS NULL OR $2 = false OR COALESCE(vas.is_eligible, false) = false)
      ORDER BY s.roll_no`,
    [assignmentId, options?.belowThresholdOnly ?? null],
  );

  return {
    assignment,
    students: studentsRes.rows,
  };
}

// ======================== CLASS STATISTICS ========================

export async function getClassStatistics(assignmentId: number, collegeId: number) {
  const report = await getAssignmentReport(assignmentId, collegeId);
  if (!report) return null;

  const students = report.students;
  const totalStudents = students.length;

  if (totalStudents === 0) {
    return {
      assignment: report.assignment,
      totalStudents: 0,
      eligibleCount: 0,
      belowThresholdCount: 0,
      averageAttendancePct: 0,
      distribution: { under50: 0, fiftyTo75: 0, seventyFiveTo85: 0, above85: 0 },
      marksAverages: { it1: null, it2: null, it3: null, assignment: null },
    };
  }

  let totalPct = 0;
  let eligibleCount = 0;
  let under50 = 0;
  let fiftyTo75 = 0;
  let seventyFiveTo85 = 0;
  let above85 = 0;

  const it1List: number[] = [];
  const it2List: number[] = [];
  const it3List: number[] = [];
  const assignList: number[] = [];

  for (const s of students) {
    const pct = Number(s.attendance_pct);
    totalPct += pct;
    if (s.is_eligible) eligibleCount++;

    if (pct < 50) under50++;
    else if (pct < 75) fiftyTo75++;
    else if (pct < 85) seventyFiveTo85++;
    else above85++;

    if (s.it1 !== null && s.it1 !== undefined) it1List.push(Number(s.it1));
    if (s.it2 !== null && s.it2 !== undefined) it2List.push(Number(s.it2));
    if (s.it3 !== null && s.it3 !== undefined) it3List.push(Number(s.it3));
    if (s.assignment !== null && s.assignment !== undefined) assignList.push(Number(s.assignment));
  }

  const avg = (list: number[]) =>
    list.length > 0 ? Number((list.reduce((a, b) => a + b, 0) / list.length).toFixed(2)) : null;

  return {
    assignment: report.assignment,
    totalStudents,
    eligibleCount,
    belowThresholdCount: totalStudents - eligibleCount,
    averageAttendancePct: Number((totalPct / totalStudents).toFixed(2)),
    distribution: {
      under50,
      fiftyTo75,
      seventyFiveTo85,
      above85,
    },
    marksAverages: {
      it1: avg(it1List),
      it2: avg(it2List),
      it3: avg(it3List),
      assignment: avg(assignList),
    },
  };
}

// ======================== COLLEGE / DEPT ANALYTICS ========================

export async function getDepartmentAnalytics(collegeId: number, departmentId?: number) {
  const { rows } = await pool.query(
    `SELECT d.id AS department_id, d.name AS department_name, d.code AS department_code,
            COUNT(DISTINCT s.id) AS total_students,
            COUNT(DISTINCT sa.id) AS total_subject_assignments,
            ROUND(AVG(vas.attendance_pct), 2) AS avg_attendance_pct,
            COUNT(DISTINCT s.id) FILTER (WHERE vas.is_eligible = false) AS below_threshold_students,
            COUNT(DISTINCT s.id) FILTER (WHERE vas.is_eligible = true)  AS eligible_students
       FROM department d
       JOIN subject su            ON su.department_id = d.id
       JOIN subject_assignment sa ON sa.subject_id = su.id
       JOIN academic_term t       ON t.id = sa.term_id AND t.is_current = true
       JOIN student s             ON s.section_id = sa.section_id
       LEFT JOIN v_attendance_summary vas
              ON vas.student_id = s.id AND vas.subject_assignment_id = sa.id
      WHERE d.college_id = $1
        AND ($2::bigint IS NULL OR d.id = $2)
      GROUP BY d.id, d.name, d.code
      ORDER BY d.name`,
    [collegeId, departmentId ?? null],
  );
  return rows;
}

// ======================== CSV FORMATTER HELPER ========================

export function formatCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const escapeCol = (val: string | number | boolean | null | undefined) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCol).join(",");
  const dataLines = rows.map((r) => r.map(escapeCol).join(","));
  return [headerLine, ...dataLines].join("\r\n");
}
