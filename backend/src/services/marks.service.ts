import pool from "../config/db";

// ======================== GET MARKS FOR AN ASSIGNMENT ========================

export async function getAssignmentMarks(assignmentId: number, collegeId: number) {
  // 1. Get assignment metadata
  const assignRes = await pool.query(
    `SELECT sa.id, sa.subject_id, sa.faculty_id, sa.section_id, sa.lab_group_id, sa.term_id,
            su.code AS subject_code, su.name AS subject_name, su.subject_type, su.is_elective,
            su.max_it_marks, su.max_assignment_marks,
            f.user_id AS faculty_user_id, f.full_name AS faculty_name,
            sec.name AS section_name,
            lg.name AS lab_group_name,
            t.academic_year, t.term_type
       FROM subject_assignment sa
       JOIN subject su        ON su.id = sa.subject_id
       JOIN faculty f         ON f.id = sa.faculty_id
       JOIN section sec       ON sec.id = sa.section_id
       LEFT JOIN lab_group lg ON lg.id = sa.lab_group_id
       JOIN academic_term t   ON t.id = sa.term_id
       JOIN department d      ON d.id = su.department_id
      WHERE sa.id = $1 AND d.college_id = $2`,
    [assignmentId, collegeId],
  );

  if (assignRes.rows.length === 0) return null;
  const assignment = assignRes.rows[0];

  // 2. Fetch all eligible students for this assignment with their pivoted marks
  const studentsRes = await pool.query(
    `SELECT s.id AS student_id, s.roll_no, s.full_name,
            vm.it1, vm.it2, vm.it3, vm.assignment
       FROM student s
       LEFT JOIN v_marks_summary vm
              ON vm.student_id = s.id AND vm.subject_assignment_id = $1
      WHERE s.section_id = $2
        AND ($3::bigint IS NULL OR s.lab_group_id = $3)
        AND (
          $4::boolean = false
          OR EXISTS (
            SELECT 1 FROM elective_enrollment ee
             WHERE ee.student_id = s.id
               AND ee.subject_id = $5
               AND ee.term_id = $6
          )
        )
      ORDER BY s.roll_no ASC`,
    [
      assignment.id,
      assignment.section_id,
      assignment.lab_group_id ?? null,
      assignment.is_elective,
      assignment.subject_id,
      assignment.term_id,
    ],
  );

  return {
    assignment,
    students: studentsRes.rows,
  };
}

// ======================== SUBMIT BULK MARKS ========================

export async function submitBulkMarks(
  assignmentId: number,
  collegeId: number,
  userId: number,
  userRole: string,
  marks: Array<{
    student_id: number;
    component: "IT1" | "IT2" | "IT3" | "ASSIGNMENT";
    marks_obtained: number;
  }>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Verify assignment exists & check faculty permission
    const assignRes = await client.query(
      `SELECT sa.id, sa.faculty_id, f.user_id AS faculty_user_id
         FROM subject_assignment sa
         JOIN subject su   ON su.id = sa.subject_id
         JOIN faculty f    ON f.id = sa.faculty_id
         JOIN department d ON d.id = su.department_id
        WHERE sa.id = $1 AND d.college_id = $2`,
      [assignmentId, collegeId],
    );

    if (assignRes.rows.length === 0) {
      throw Object.assign(new Error("Subject assignment not found"), { status: 404 });
    }

    const assignment = assignRes.rows[0];

    // Faculty can only enter marks for their own subject assignments
    if (userRole === "faculty" && assignment.faculty_user_id !== userId) {
      throw Object.assign(
        new Error("Forbidden: You can only enter marks for your own assigned subjects"),
        { status: 403 },
      );
    }

    // 2. Bulk upsert marks in a single transaction
    // Trigger trg_marks_guard will raise exception if marks_obtained > max mark
    for (const item of marks) {
      await client.query(
        `INSERT INTO marks (student_id, subject_assignment_id, component, marks_obtained, entered_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (student_id, subject_assignment_id, component)
         DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained,
                       entered_by     = EXCLUDED.entered_by,
                       updated_at     = now()`,
        [item.student_id, assignmentId, item.component, item.marks_obtained, assignment.faculty_id],
      );
    }

    await client.query("COMMIT");

    return {
      message: `Successfully saved marks for ${marks.length} record(s)`,
      savedCount: marks.length,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
