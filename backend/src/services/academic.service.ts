import bcrypt from "bcrypt";
import pool from "../config/db";

// ======================== STUDENTS ========================

export async function listStudents(
  collegeId: number,
  options?: { departmentId?: number; sectionId?: number },
) {
  const { rows } = await pool.query(
    `SELECT s.id, s.user_id, s.roll_no, s.full_name, s.admission_year,
            s.section_id, sec.name AS section_name,
            s.lab_group_id, lg.name AS lab_group_name,
            u.email, u.is_active,
            b.id AS batch_id, b.start_year, b.end_year,
            p.id AS program_id, p.name AS program_name,
            d.id AS department_id, d.name AS department_name
       FROM student s
       JOIN app_user u        ON u.id = s.user_id
       JOIN section sec       ON sec.id = s.section_id
       LEFT JOIN lab_group lg ON lg.id = s.lab_group_id
       JOIN batch b           ON b.id = sec.batch_id
       JOIN program p         ON p.id = b.program_id
       JOIN department d      ON d.id = p.department_id
      WHERE u.college_id = $1
        AND ($2::bigint IS NULL OR d.id = $2)
        AND ($3::bigint IS NULL OR s.section_id = $3)
      ORDER BY s.roll_no ASC`,
    [collegeId, options?.departmentId ?? null, options?.sectionId ?? null],
  );
  return rows;
}

export async function createStudent(
  collegeId: number,
  data: {
    email: string;
    password: string;
    section_id: number;
    lab_group_id?: number | null;
    roll_no: string;
    full_name: string;
    admission_year: number;
  },
  departmentIdScope?: number,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify section belongs to college and find department_id
    const secRes = await client.query(
      `SELECT d.id AS department_id
         FROM section sec
         JOIN batch b ON b.id = sec.batch_id
         JOIN program p ON p.id = b.program_id
         JOIN department d ON d.id = p.department_id
        WHERE sec.id = $1 AND d.college_id = $2`,
      [data.section_id, collegeId],
    );
    if (secRes.rows.length === 0) {
      throw Object.assign(new Error("Section not found in this college"), { status: 404 });
    }
    const departmentId = secRes.rows[0].department_id;

    if (departmentIdScope && departmentId !== departmentIdScope) {
      throw Object.assign(new Error("Forbidden: can only create students in your own department"), { status: 403 });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const userRes = await client.query(
      `INSERT INTO app_user (college_id, department_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'student')
       RETURNING id, email, role, is_active, created_at`,
      [collegeId, departmentId, data.email.toLowerCase(), passwordHash],
    );
    const user = userRes.rows[0];

    const studentRes = await client.query(
      `INSERT INTO student (user_id, section_id, lab_group_id, roll_no, full_name, admission_year)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, section_id, lab_group_id, roll_no, full_name, admission_year`,
      [user.id, data.section_id, data.lab_group_id ?? null, data.roll_no, data.full_name, data.admission_year],
    );

    await client.query("COMMIT");
    return { ...studentRes.rows[0], user };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ======================== FACULTY ========================

export async function listFaculty(collegeId: number, departmentId?: number) {
  const { rows } = await pool.query(
    `SELECT f.id, f.user_id, f.employee_code, f.full_name, f.designation,
            f.department_id, d.name AS department_name, d.code AS department_code,
            u.email, u.is_active
       FROM faculty f
       JOIN app_user u   ON u.id = f.user_id
       JOIN department d ON d.id = f.department_id
      WHERE u.college_id = $1
        AND ($2::bigint IS NULL OR f.department_id = $2)
      ORDER BY f.full_name ASC`,
    [collegeId, departmentId ?? null],
  );
  return rows;
}

export async function createFaculty(
  collegeId: number,
  data: {
    email: string;
    password: string;
    department_id: number;
    employee_code: string;
    full_name: string;
    designation?: string;
  },
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify department belongs to college
    const deptRes = await client.query(
      `SELECT id FROM department WHERE id = $1 AND college_id = $2`,
      [data.department_id, collegeId],
    );
    if (deptRes.rows.length === 0) {
      throw Object.assign(new Error("Department not found in this college"), { status: 404 });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const userRes = await client.query(
      `INSERT INTO app_user (college_id, department_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'faculty')
       RETURNING id, email, role, is_active, created_at`,
      [collegeId, data.department_id, data.email.toLowerCase(), passwordHash],
    );
    const user = userRes.rows[0];

    const facultyRes = await client.query(
      `INSERT INTO faculty (user_id, department_id, employee_code, full_name, designation)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, department_id, employee_code, full_name, designation`,
      [user.id, data.department_id, data.employee_code, data.full_name, data.designation ?? null],
    );

    await client.query("COMMIT");
    return { ...facultyRes.rows[0], user };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ======================== USER DEACTIVATION ========================

export async function setUserActiveStatus(userId: number, collegeId: number, isActive: boolean) {
  const { rows } = await pool.query(
    `UPDATE app_user
        SET is_active = $1
      WHERE id = $2 AND college_id = $3
      RETURNING id, email, role, is_active`,
    [isActive, userId, collegeId],
  );
  return rows[0] || null;
}

// ======================== SUBJECTS ========================

export async function listSubjects(
  collegeId: number,
  options?: { departmentId?: number; semester?: number },
) {
  const { rows } = await pool.query(
    `SELECT s.id, s.department_id, s.code, s.name, s.subject_type,
            s.semester, s.is_elective, s.max_it_marks, s.max_assignment_marks,
            s.is_active, d.name AS department_name, d.code AS department_code
       FROM subject s
       JOIN department d ON d.id = s.department_id
      WHERE d.college_id = $1
        AND ($2::bigint IS NULL OR s.department_id = $2)
        AND ($3::smallint IS NULL OR s.semester = $3)
      ORDER BY s.semester, s.code`,
    [collegeId, options?.departmentId ?? null, options?.semester ?? null],
  );
  return rows;
}

export async function createSubject(
  collegeId: number,
  data: {
    department_id: number;
    code: string;
    name: string;
    subject_type: "theory" | "lab";
    semester: number;
    is_elective: boolean;
    max_it_marks: number;
    max_assignment_marks: number;
  },
) {
  const check = await pool.query(
    `SELECT id FROM department WHERE id = $1 AND college_id = $2`,
    [data.department_id, collegeId],
  );
  if (check.rows.length === 0) {
    throw Object.assign(new Error("Department not found in this college"), { status: 404 });
  }

  const { rows } = await pool.query(
    `INSERT INTO subject (department_id, code, name, subject_type, semester, is_elective, max_it_marks, max_assignment_marks)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, department_id, code, name, subject_type, semester, is_elective, max_it_marks, max_assignment_marks, is_active`,
    [
      data.department_id,
      data.code,
      data.name,
      data.subject_type,
      data.semester,
      data.is_elective,
      data.max_it_marks,
      data.max_assignment_marks,
    ],
  );
  return rows[0];
}

export async function updateSubject(
  id: number,
  collegeId: number,
  data: {
    name?: string;
    subject_type?: "theory" | "lab";
    semester?: number;
    is_elective?: boolean;
    max_it_marks?: number;
    max_assignment_marks?: number;
    is_active?: boolean;
  },
) {
  const { rows } = await pool.query(
    `UPDATE subject s
        SET name                 = COALESCE($3, s.name),
            subject_type         = COALESCE($4, s.subject_type),
            semester             = COALESCE($5, s.semester),
            is_elective          = COALESCE($6, s.is_elective),
            max_it_marks         = COALESCE($7, s.max_it_marks),
            max_assignment_marks = COALESCE($8, s.max_assignment_marks),
            is_active            = COALESCE($9, s.is_active)
       FROM department d
      WHERE s.id = $1 AND d.id = s.department_id AND d.college_id = $2
      RETURNING s.id, s.department_id, s.code, s.name, s.subject_type,
                s.semester, s.is_elective, s.max_it_marks, s.max_assignment_marks, s.is_active`,
    [
      id,
      collegeId,
      data.name ?? null,
      data.subject_type ?? null,
      data.semester ?? null,
      data.is_elective ?? null,
      data.max_it_marks ?? null,
      data.max_assignment_marks ?? null,
      data.is_active ?? null,
    ],
  );
  return rows[0] || null;
}

// ======================== SUBJECT ASSIGNMENTS ========================

export async function listSubjectAssignments(
  collegeId: number,
  options?: { departmentId?: number; termId?: number; facultyId?: number; sectionId?: number },
) {
  const { rows } = await pool.query(
    `SELECT sa.id, sa.subject_id, sa.faculty_id, sa.section_id, sa.lab_group_id, sa.term_id,
            su.code AS subject_code, su.name AS subject_name, su.subject_type, su.is_elective,
            su.max_it_marks, su.max_assignment_marks,
            f.full_name AS faculty_name, f.employee_code,
            sec.name AS section_name,
            lg.name AS lab_group_name,
            t.academic_year, t.term_type,
            d.id AS department_id, d.name AS department_name
       FROM subject_assignment sa
       JOIN subject su        ON su.id = sa.subject_id
       JOIN faculty f         ON f.id = sa.faculty_id
       JOIN section sec       ON sec.id = sa.section_id
       LEFT JOIN lab_group lg ON lg.id = sa.lab_group_id
       JOIN academic_term t   ON t.id = sa.term_id
       JOIN department d      ON d.id = su.department_id
      WHERE d.college_id = $1
        AND ($2::bigint IS NULL OR d.id = $2)
        AND ($3::bigint IS NULL OR sa.term_id = $3)
        AND ($4::bigint IS NULL OR sa.faculty_id = $4)
        AND ($5::bigint IS NULL OR sa.section_id = $5)
      ORDER BY su.code, sec.name`,
    [
      collegeId,
      options?.departmentId ?? null,
      options?.termId ?? null,
      options?.facultyId ?? null,
      options?.sectionId ?? null,
    ],
  );
  return rows;
}

export async function createSubjectAssignment(
  collegeId: number,
  data: {
    subject_id: number;
    faculty_id: number;
    section_id: number;
    lab_group_id?: number | null;
    term_id: number;
  },
  departmentIdScope?: number,
) {
  // 1. Validate subject belongs to this college (and scoped department)
  const subjCheck = await pool.query(
    `SELECT s.id, s.department_id, s.subject_type FROM subject s
       JOIN department d ON d.id = s.department_id
      WHERE s.id = $1 AND d.college_id = $2`,
    [data.subject_id, collegeId],
  );
  if (subjCheck.rows.length === 0) {
    throw Object.assign(new Error("Subject not found in this college"), { status: 404 });
  }
  const subject = subjCheck.rows[0];
  if (departmentIdScope && subject.department_id !== departmentIdScope) {
    throw Object.assign(new Error("Cannot assign subject from another department"), { status: 403 });
  }

  // 2. Validate faculty belongs to this college (and scoped department)
  const facultyCheck = await pool.query(
    `SELECT f.id, f.department_id FROM faculty f
       JOIN department d ON d.id = f.department_id
      WHERE f.id = $1 AND d.college_id = $2`,
    [data.faculty_id, collegeId],
  );
  if (facultyCheck.rows.length === 0) {
    throw Object.assign(new Error("Faculty not found in this college"), { status: 404 });
  }
  if (departmentIdScope && facultyCheck.rows[0].department_id !== departmentIdScope) {
    throw Object.assign(new Error("Cannot assign faculty from another department"), { status: 403 });
  }

  // 3. Validate section belongs to this college (and scoped department)
  const secCheck = await pool.query(
    `SELECT sec.id, p.department_id FROM section sec
       JOIN batch b ON b.id = sec.batch_id
       JOIN program p ON p.id = b.program_id
       JOIN department d ON d.id = p.department_id
      WHERE sec.id = $1 AND d.college_id = $2`,
    [data.section_id, collegeId],
  );
  if (secCheck.rows.length === 0) {
    throw Object.assign(new Error("Section not found in this college"), { status: 404 });
  }
  if (departmentIdScope && secCheck.rows[0].department_id !== departmentIdScope) {
    throw Object.assign(new Error("Cannot assign section from another department"), { status: 403 });
  }

  // 4. Validate academic term belongs to this college
  const termCheck = await pool.query(
    `SELECT id FROM academic_term WHERE id = $1 AND college_id = $2`,
    [data.term_id, collegeId],
  );
  if (termCheck.rows.length === 0) {
    throw Object.assign(new Error("Academic term not found in this college"), { status: 404 });
  }

  // 5. Validate lab group if provided
  if (data.lab_group_id) {
    if (subject.subject_type !== "lab") {
      throw Object.assign(new Error("Cannot assign a lab group to a theory subject"), { status: 400 });
    }
    const lgCheck = await pool.query(
      `SELECT lg.id FROM lab_group lg
         JOIN section sec  ON sec.id = lg.section_id
         JOIN batch b      ON b.id = sec.batch_id
         JOIN program p    ON p.id = b.program_id
         JOIN department d ON d.id = p.department_id
        WHERE lg.id = $1 AND lg.section_id = $2 AND d.college_id = $3`,
      [data.lab_group_id, data.section_id, collegeId],
    );
    if (lgCheck.rows.length === 0) {
      throw Object.assign(new Error("Selected lab group does not belong to the selected section"), { status: 400 });
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO subject_assignment (subject_id, faculty_id, section_id, lab_group_id, term_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, subject_id, faculty_id, section_id, lab_group_id, term_id`,
    [data.subject_id, data.faculty_id, data.section_id, data.lab_group_id ?? null, data.term_id],
  );
  return rows[0];
}

// ======================== ELECTIVE ENROLLMENT ========================

export async function listElectiveEnrollments(
  collegeId: number,
  options?: { subjectId?: number; termId?: number; studentId?: number },
) {
  const { rows } = await pool.query(
    `SELECT ee.id, ee.student_id, ee.subject_id, ee.term_id,
            st.roll_no, st.full_name AS student_name,
            su.code AS subject_code, su.name AS subject_name,
            t.academic_year, t.term_type
       FROM elective_enrollment ee
       JOIN student st      ON st.id = ee.student_id
       JOIN subject su      ON su.id = ee.subject_id
       JOIN department d    ON d.id = su.department_id
       JOIN academic_term t ON t.id = ee.term_id
      WHERE d.college_id = $1
        AND ($2::bigint IS NULL OR ee.subject_id = $2)
        AND ($3::bigint IS NULL OR ee.term_id = $3)
        AND ($4::bigint IS NULL OR ee.student_id = $4)
      ORDER BY st.roll_no`,
    [collegeId, options?.subjectId ?? null, options?.termId ?? null, options?.studentId ?? null],
  );
  return rows;
}

export async function enrollElective(
  data: { student_id: number; subject_id: number; term_id: number },
) {
  // DB trigger `elective_guard` checks if subject is_elective
  const { rows } = await pool.query(
    `INSERT INTO elective_enrollment (student_id, subject_id, term_id)
     VALUES ($1, $2, $3)
     RETURNING id, student_id, subject_id, term_id`,
    [data.student_id, data.subject_id, data.term_id],
  );
  return rows[0];
}

export async function bulkEnrollElective(
  data: { student_ids: number[]; subject_id: number; term_id: number },
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const results = [];
    for (const studentId of data.student_ids) {
      const { rows } = await client.query(
        `INSERT INTO elective_enrollment (student_id, subject_id, term_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (student_id, subject_id, term_id) DO NOTHING
         RETURNING id, student_id, subject_id, term_id`,
        [studentId, data.subject_id, data.term_id],
      );
      if (rows[0]) results.push(rows[0]);
    }
    await client.query("COMMIT");
    return results;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
