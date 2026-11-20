import pool from "../config/db";

// ======================== DEPARTMENTS ========================

export async function listDepartments(collegeId: number) {
  const { rows } = await pool.query(
    `SELECT id, college_id, name, code, is_active
       FROM department
      WHERE college_id = $1
      ORDER BY name`,
    [collegeId],
  );
  return rows;
}

export async function getDepartment(id: number, collegeId: number) {
  const { rows } = await pool.query(
    `SELECT id, college_id, name, code, is_active
       FROM department
      WHERE id = $1 AND college_id = $2`,
    [id, collegeId],
  );
  return rows[0] || null;
}

export async function createDepartment(
  collegeId: number,
  data: { name: string; code: string },
) {
  const { rows } = await pool.query(
    `INSERT INTO department (college_id, name, code)
     VALUES ($1, $2, $3)
     RETURNING id, college_id, name, code, is_active`,
    [collegeId, data.name, data.code],
  );
  return rows[0];
}

export async function updateDepartment(
  id: number,
  collegeId: number,
  data: { name?: string; code?: string; is_active?: boolean },
) {
  const { rows } = await pool.query(
    `UPDATE department
        SET name      = COALESCE($3, name),
            code      = COALESCE($4, code),
            is_active = COALESCE($5, is_active)
      WHERE id = $1 AND college_id = $2
      RETURNING id, college_id, name, code, is_active`,
    [id, collegeId, data.name ?? null, data.code ?? null, data.is_active ?? null],
  );
  return rows[0] || null;
}

// ======================== PROGRAMS ========================

export async function listPrograms(collegeId: number, departmentId?: number) {
  const { rows } = await pool.query(
    `SELECT p.id, p.department_id, p.name, p.level, p.duration_years, p.is_active
       FROM program p
       JOIN department d ON d.id = p.department_id
      WHERE d.college_id = $1
        AND ($2::bigint IS NULL OR p.department_id = $2)
      ORDER BY p.name`,
    [collegeId, departmentId ?? null],
  );
  return rows;
}

export async function getProgram(id: number, collegeId: number) {
  const { rows } = await pool.query(
    `SELECT p.id, p.department_id, p.name, p.level, p.duration_years, p.is_active
       FROM program p
       JOIN department d ON d.id = p.department_id
      WHERE p.id = $1 AND d.college_id = $2`,
    [id, collegeId],
  );
  return rows[0] || null;
}

export async function createProgram(
  collegeId: number,
  data: { department_id: number; name: string; level: string; duration_years: number },
) {
  // Verify department belongs to this college
  const dept = await getDepartment(data.department_id, collegeId);
  if (!dept) throw Object.assign(new Error("Department not found in this college"), { status: 404 });

  const { rows } = await pool.query(
    `INSERT INTO program (department_id, name, level, duration_years)
     VALUES ($1, $2, $3, $4)
     RETURNING id, department_id, name, level, duration_years, is_active`,
    [data.department_id, data.name, data.level, data.duration_years],
  );
  return rows[0];
}

export async function updateProgram(
  id: number,
  collegeId: number,
  data: { name?: string; level?: string; duration_years?: number; is_active?: boolean },
) {
  const { rows } = await pool.query(
    `UPDATE program p
        SET name           = COALESCE($3, p.name),
            level          = COALESCE($4, p.level),
            duration_years = COALESCE($5, p.duration_years),
            is_active      = COALESCE($6, p.is_active)
       FROM department d
      WHERE p.id = $1 AND d.id = p.department_id AND d.college_id = $2
      RETURNING p.id, p.department_id, p.name, p.level, p.duration_years, p.is_active`,
    [id, collegeId, data.name ?? null, data.level ?? null, data.duration_years ?? null, data.is_active ?? null],
  );
  return rows[0] || null;
}

// ======================== BATCHES ========================

export async function listBatches(collegeId: number, departmentId?: number) {
  const { rows } = await pool.query(
    `SELECT b.id, b.program_id, b.start_year, b.end_year, b.is_active,
            p.name AS program_name
       FROM batch b
       JOIN program p    ON p.id = b.program_id
       JOIN department d ON d.id = p.department_id
      WHERE d.college_id = $1
        AND ($2::bigint IS NULL OR p.department_id = $2)
      ORDER BY b.start_year DESC`,
    [collegeId, departmentId ?? null],
  );
  return rows;
}

export async function createBatch(
  collegeId: number,
  data: { program_id: number; start_year: number; end_year: number },
) {
  // Verify program belongs to college
  const prog = await getProgram(data.program_id, collegeId);
  if (!prog) throw Object.assign(new Error("Program not found in this college"), { status: 404 });

  const { rows } = await pool.query(
    `INSERT INTO batch (program_id, start_year, end_year)
     VALUES ($1, $2, $3)
     RETURNING id, program_id, start_year, end_year, is_active`,
    [data.program_id, data.start_year, data.end_year],
  );
  return rows[0];
}

export async function updateBatch(
  id: number,
  collegeId: number,
  data: { is_active?: boolean },
) {
  const { rows } = await pool.query(
    `UPDATE batch b
        SET is_active = COALESCE($3, b.is_active)
       FROM program p
       JOIN department d ON d.id = p.department_id
      WHERE b.id = $1 AND p.id = b.program_id AND d.college_id = $2
      RETURNING b.id, b.program_id, b.start_year, b.end_year, b.is_active`,
    [id, collegeId, data.is_active ?? null],
  );
  return rows[0] || null;
}

// ======================== SECTIONS ========================

export async function listSections(collegeId: number, batchId?: number) {
  const { rows } = await pool.query(
    `SELECT s.id, s.batch_id, s.name,
            b.start_year, b.end_year, p.name AS program_name
       FROM section s
       JOIN batch b      ON b.id = s.batch_id
       JOIN program p    ON p.id = b.program_id
       JOIN department d ON d.id = p.department_id
      WHERE d.college_id = $1
        AND ($2::bigint IS NULL OR s.batch_id = $2)
      ORDER BY s.name`,
    [collegeId, batchId ?? null],
  );
  return rows;
}

export async function createSection(
  collegeId: number,
  data: { batch_id: number; name: string },
) {
  // Verify batch belongs to college (join through program->dept)
  const check = await pool.query(
    `SELECT b.id FROM batch b
       JOIN program p    ON p.id = b.program_id
       JOIN department d ON d.id = p.department_id
      WHERE b.id = $1 AND d.college_id = $2`,
    [data.batch_id, collegeId],
  );
  if (check.rows.length === 0)
    throw Object.assign(new Error("Batch not found in this college"), { status: 404 });

  const { rows } = await pool.query(
    `INSERT INTO section (batch_id, name)
     VALUES ($1, $2)
     RETURNING id, batch_id, name`,
    [data.batch_id, data.name],
  );
  return rows[0];
}

// ======================== LAB GROUPS ========================

export async function listLabGroups(collegeId: number, sectionId?: number) {
  const { rows } = await pool.query(
    `SELECT lg.id, lg.section_id, lg.name, sec.name AS section_name
       FROM lab_group lg
       JOIN section sec  ON sec.id = lg.section_id
       JOIN batch b      ON b.id = sec.batch_id
       JOIN program p    ON p.id = b.program_id
       JOIN department d ON d.id = p.department_id
      WHERE d.college_id = $1
        AND ($2::bigint IS NULL OR lg.section_id = $2)
      ORDER BY lg.name`,
    [collegeId, sectionId ?? null],
  );
  return rows;
}

export async function createLabGroup(
  collegeId: number,
  data: { section_id: number; name: string },
) {
  // Verify section belongs to college
  const check = await pool.query(
    `SELECT sec.id FROM section sec
       JOIN batch b      ON b.id = sec.batch_id
       JOIN program p    ON p.id = b.program_id
       JOIN department d ON d.id = p.department_id
      WHERE sec.id = $1 AND d.college_id = $2`,
    [data.section_id, collegeId],
  );
  if (check.rows.length === 0)
    throw Object.assign(new Error("Section not found in this college"), { status: 404 });

  const { rows } = await pool.query(
    `INSERT INTO lab_group (section_id, name)
     VALUES ($1, $2)
     RETURNING id, section_id, name`,
    [data.section_id, data.name],
  );
  return rows[0];
}

// ======================== ACADEMIC TERMS ========================

export async function listAcademicTerms(collegeId: number) {
  const { rows } = await pool.query(
    `SELECT id, college_id, academic_year, term_type, start_date, end_date, is_current
       FROM academic_term
      WHERE college_id = $1
      ORDER BY start_date DESC`,
    [collegeId],
  );
  return rows;
}

export async function getCurrentTerm(collegeId: number) {
  const { rows } = await pool.query(
    `SELECT id, college_id, academic_year, term_type, start_date, end_date, is_current
       FROM academic_term
      WHERE college_id = $1
      ORDER BY is_current DESC, start_date DESC
      LIMIT 1`,
    [collegeId],
  );
  return rows[0] || null;
}

export async function createAcademicTerm(
  collegeId: number,
  data: {
    academic_year: string;
    term_type: string;
    start_date: string;
    end_date: string;
    is_current?: boolean;
  },
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // If setting as current, unset any existing current term
    if (data.is_current) {
      await client.query(
        `UPDATE academic_term SET is_current = false WHERE college_id = $1 AND is_current = true`,
        [collegeId],
      );
    }

    const { rows } = await client.query(
      `INSERT INTO academic_term (college_id, academic_year, term_type, start_date, end_date, is_current)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, college_id, academic_year, term_type, start_date, end_date, is_current`,
      [collegeId, data.academic_year, data.term_type, data.start_date, data.end_date, data.is_current ?? false],
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateAcademicTerm(
  id: number,
  collegeId: number,
  data: {
    academic_year?: string;
    term_type?: string;
    start_date?: string;
    end_date?: string;
    is_current?: boolean;
  },
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // If setting as current, unset any existing current term
    if (data.is_current) {
      await client.query(
        `UPDATE academic_term SET is_current = false WHERE college_id = $1 AND is_current = true AND id != $2`,
        [collegeId, id],
      );
    }

    const { rows } = await client.query(
      `UPDATE academic_term
          SET academic_year = COALESCE($3, academic_year),
              term_type     = COALESCE($4, term_type),
              start_date    = COALESCE($5, start_date),
              end_date      = COALESCE($6, end_date),
              is_current    = COALESCE($7, is_current)
        WHERE id = $1 AND college_id = $2
        RETURNING id, college_id, academic_year, term_type, start_date, end_date, is_current`,
      [
        id,
        collegeId,
        data.academic_year ?? null,
        data.term_type ?? null,
        data.start_date ?? null,
        data.end_date ?? null,
        data.is_current ?? null,
      ],
    );

    await client.query("COMMIT");
    return rows[0] || null;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ======================== SETTINGS ========================

export async function getSettings(collegeId: number) {
  const { rows } = await pool.query(
    `SELECT id, college_id, attendance_threshold
       FROM settings
      WHERE college_id = $1`,
    [collegeId],
  );
  return rows[0] || null;
}

export async function upsertSettings(collegeId: number, data: { attendance_threshold: number }) {
  const { rows } = await pool.query(
    `INSERT INTO settings (college_id, attendance_threshold)
     VALUES ($1, $2)
     ON CONFLICT (college_id)
     DO UPDATE SET attendance_threshold = EXCLUDED.attendance_threshold
     RETURNING id, college_id, attendance_threshold`,
    [collegeId, data.attendance_threshold],
  );
  return rows[0];
}

