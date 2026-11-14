import pool from "../config/db";

// ======================== TIMETABLE SLOTS ========================

export async function listSlots(
  collegeId: number,
  options?: {
    termId?: number;
    departmentId?: number;
    facultyId?: number;
    userId?: number;
    sectionId?: number;
    dayOfWeek?: number;
  },
) {
  const { rows } = await pool.query(
    `SELECT ts.id, ts.subject_assignment_id, ts.faculty_id, ts.term_id,
            ts.day_of_week, ts.period_no, ts.start_time, ts.end_time, ts.room,
            sa.subject_id, su.code AS subject_code, su.name AS subject_name, su.subject_type,
            sa.section_id, sec.name AS section_name,
            sa.lab_group_id, lg.name AS lab_group_name,
            f.full_name AS faculty_name, f.employee_code,
            d.id AS department_id, d.name AS department_name
       FROM timetable_slot ts
       JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
       JOIN subject su            ON su.id = sa.subject_id
       JOIN faculty f             ON f.id = ts.faculty_id
       JOIN section sec           ON sec.id = sa.section_id
       LEFT JOIN lab_group lg     ON lg.id = sa.lab_group_id
       JOIN department d          ON d.id = su.department_id
      WHERE d.college_id = $1
        AND ($2::bigint IS NULL OR ts.term_id = $2)
        AND ($3::bigint IS NULL OR d.id = $3)
        AND ($4::bigint IS NULL OR ts.faculty_id = $4)
        AND ($5::bigint IS NULL OR sa.section_id = $5)
        AND ($6::smallint IS NULL OR ts.day_of_week = $6)
        AND ($7::bigint IS NULL OR f.user_id = $7)
      ORDER BY ts.day_of_week, ts.period_no`,
    [
      collegeId,
      options?.termId ?? null,
      options?.departmentId ?? null,
      options?.facultyId ?? null,
      options?.sectionId ?? null,
      options?.dayOfWeek ?? null,
      options?.userId ?? null,
    ],
  );
  return rows;
}

export async function createSlot(
  collegeId: number,
  data: {
    subject_assignment_id: number;
    day_of_week: number;
    period_no: number;
    start_time: string;
    end_time: string;
    room: string;
  },
) {
  // Verify assignment belongs to this college
  const check = await pool.query(
    `SELECT sa.id FROM subject_assignment sa
       JOIN subject su   ON su.id = sa.subject_id
       JOIN department d ON d.id = su.department_id
      WHERE sa.id = $1 AND d.college_id = $2`,
    [data.subject_assignment_id, collegeId],
  );
  if (check.rows.length === 0) {
    throw Object.assign(new Error("Subject assignment not found in this college"), { status: 404 });
  }

  // Trigger trg_slot_fill will populate faculty_id and term_id from subject_assignment
  // Dummy 0s passed for faculty_id and term_id because columns are NOT NULL, trigger sets them BEFORE INSERT
  // Actually, in schema.sql:
  // CREATE FUNCTION trg_slot_fill() ... SELECT faculty_id, term_id INTO NEW.faculty_id, NEW.term_id
  // and trigger is BEFORE INSERT OR UPDATE ON timetable_slot.
  // Passing 1 or selecting them directly in SQL query:
  const { rows } = await pool.query(
    `INSERT INTO timetable_slot (subject_assignment_id, faculty_id, term_id, day_of_week, period_no, start_time, end_time, room)
     SELECT sa.id, sa.faculty_id, sa.term_id, $2, $3, $4::time, $5::time, $6
       FROM subject_assignment sa
      WHERE sa.id = $1
     RETURNING id, subject_assignment_id, faculty_id, term_id, day_of_week, period_no, start_time, end_time, room`,
    [
      data.subject_assignment_id,
      data.day_of_week,
      data.period_no,
      data.start_time,
      data.end_time,
      data.room,
    ],
  );
  return rows[0];
}

export async function deleteSlot(slotId: number, collegeId: number) {
  const { rowCount } = await pool.query(
    `DELETE FROM timetable_slot ts
      USING subject_assignment sa, subject su, department d
      WHERE ts.id = $1
        AND sa.id = ts.subject_assignment_id
        AND su.id = sa.subject_id
        AND d.id = su.department_id
        AND d.college_id = $2`,
    [slotId, collegeId],
  );
  return (rowCount ?? 0) > 0;
}

// ======================== LECTURE SESSIONS ========================

export async function listLectureSessions(
  collegeId: number,
  options?: {
    startDate?: string;
    endDate?: string;
    date?: string;
    facultyId?: number;
    userId?: number;
    sectionId?: number;
    status?: string;
    isLocked?: boolean;
    subjectAssignmentId?: number;
  },
) {
  const { rows } = await pool.query(
    `SELECT ls.id, ls.timetable_slot_id, ls.session_date, ls.status,
            ls.is_locked, ls.locked_at, ls.locked_by,
            ts.day_of_week, ts.period_no, ts.start_time, ts.end_time, ts.room,
            ts.subject_assignment_id,
            sa.subject_id, su.code AS subject_code, su.name AS subject_name, su.subject_type, su.is_elective,
            sa.section_id, sec.name AS section_name,
            sa.lab_group_id, lg.name AS lab_group_name,
            f.id AS faculty_id, f.full_name AS faculty_name, f.employee_code
       FROM lecture_session ls
       JOIN timetable_slot ts     ON ts.id = ls.timetable_slot_id
       JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
       JOIN subject su            ON su.id = sa.subject_id
       JOIN faculty f             ON f.id = ts.faculty_id
       JOIN section sec           ON sec.id = sa.section_id
       LEFT JOIN lab_group lg     ON lg.id = sa.lab_group_id
       JOIN department d          ON d.id = su.department_id
      WHERE d.college_id = $1
        AND ($2::date IS NULL OR ls.session_date >= $2)
        AND ($3::date IS NULL OR ls.session_date <= $3)
        AND ($4::date IS NULL OR ls.session_date = $4)
        AND ($5::bigint IS NULL OR ts.faculty_id = $5)
        AND ($6::bigint IS NULL OR sa.section_id = $6)
        AND ($7::varchar IS NULL OR ls.status = $7)
        AND ($8::boolean IS NULL OR ls.is_locked = $8)
        AND ($9::bigint IS NULL OR sa.id = $9)
        AND ($10::bigint IS NULL OR f.user_id = $10)
      ORDER BY ls.session_date, ts.period_no`,
    [
      collegeId,
      options?.startDate ?? null,
      options?.endDate ?? null,
      options?.date ?? null,
      options?.facultyId ?? null,
      options?.sectionId ?? null,
      options?.status ?? null,
      options?.isLocked !== undefined ? options.isLocked : null,
      options?.subjectAssignmentId ?? null,
      options?.userId ?? null,
    ],
  );
  return rows;
}

export async function generateLectureSessions(
  collegeId: number,
  data: {
    start_date: string;
    end_date: string;
    term_id?: number;
    slot_id?: number;
  },
) {
  const { rows } = await pool.query(
    `INSERT INTO lecture_session (timetable_slot_id, session_date)
     SELECT ts.id, d::date
       FROM timetable_slot ts
       JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
       JOIN subject su            ON su.id = sa.subject_id
       JOIN department dep        ON dep.id = su.department_id,
       generate_series($1::date, $2::date, INTERVAL '1 day') AS d
      WHERE dep.college_id = $3
        AND ($4::bigint IS NULL OR ts.term_id = $4)
        AND ($5::bigint IS NULL OR ts.id = $5)
        AND EXTRACT(ISODOW FROM d::date) = ts.day_of_week
     ON CONFLICT (timetable_slot_id, session_date) DO NOTHING
     RETURNING id, timetable_slot_id, session_date, status, is_locked`,
    [
      data.start_date,
      data.end_date,
      collegeId,
      data.term_id ?? null,
      data.slot_id ?? null,
    ],
  );
  return rows;
}

export async function cancelLectureSession(sessionId: number, collegeId: number) {
  // DB trigger `lecture_session_guard` ensures locked lecture cannot be modified
  const { rows } = await pool.query(
    `UPDATE lecture_session ls
        SET status = 'cancelled'
       FROM timetable_slot ts, subject_assignment sa, subject su, department d
      WHERE ls.id = $1
        AND ts.id = ls.timetable_slot_id
        AND sa.id = ts.subject_assignment_id
        AND su.id = sa.subject_id
        AND d.id = su.department_id
        AND d.college_id = $2
      RETURNING ls.id, ls.timetable_slot_id, ls.session_date, ls.status, ls.is_locked`,
    [sessionId, collegeId],
  );
  return rows[0] || null;
}
