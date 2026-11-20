import pool from "../config/db";

// ======================== SESSION MATERIALIZATION ========================

/**
 * Concurrency-safe, idempotent materialization of lecture sessions for a date range.
 * Resolves the applicable academic term(s), checks weekdays, and inserts
 * scheduled sessions for all timetable slots matching the day of week.
 *
 * Guarantees:
 * 1. Idempotency: ON CONFLICT (timetable_slot_id, session_date) DO NOTHING prevents duplicate sessions.
 * 2. Concurrency Safety: Managed at the PostgreSQL unique index level.
 * 3. State Preservation: Existing cancelled, held, and locked sessions or sessions with attendance are untouched.
 * 4. Sunday (ISO DOW 7) has no university slots and is automatically skipped.
 */
export async function ensureLectureSessionsForDateRange(
  collegeId: number,
  startDateStr: string,
  endDateStr: string,
): Promise<number> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
    return 0;
  }

  // 1. Find academic terms covering the date range for this college
  const termsRes = await pool.query(
    `SELECT id, academic_year, term_type, start_date, end_date, is_current
       FROM academic_term
      WHERE college_id = $1
        AND (
          (start_date <= $3::date AND end_date >= $2::date)
          OR (is_current = true AND $2::date >= start_date - INTERVAL '7 days' AND $3::date <= end_date + INTERVAL '7 days')
        )
      ORDER BY
        CASE WHEN start_date <= $3::date AND end_date >= $2::date THEN 0 ELSE 1 END,
        is_current DESC,
        start_date DESC`,
    [collegeId, startDateStr, endDateStr],
  );

  if (termsRes.rows.length === 0) {
    return 0;
  }

  let totalInserted = 0;
  for (const term of termsRes.rows) {
    // Generate dates intersecting the requested range with the term boundaries
    const insertRes = await pool.query(
      `INSERT INTO lecture_session (timetable_slot_id, session_date, status)
       SELECT ts.id, dt::date, 'scheduled'
         FROM timetable_slot ts
         JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
         JOIN subject su            ON su.id = sa.subject_id
         JOIN department dep        ON dep.id = su.department_id,
         generate_series(
           GREATEST($2::date, $4::date),
           LEAST($3::date, $5::date),
           INTERVAL '1 day'
         ) AS dt
        WHERE dep.college_id = $1
          AND ts.term_id = $6
          AND EXTRACT(ISODOW FROM dt::date) = ts.day_of_week
          AND EXTRACT(ISODOW FROM dt::date) BETWEEN 1 AND 6
       ON CONFLICT (timetable_slot_id, session_date) DO NOTHING
       RETURNING id`,
      [
        collegeId,
        startDateStr,
        endDateStr,
        term.start_date,
        term.end_date,
        term.id,
      ],
    );
    totalInserted += insertRes.rowCount ?? 0;
  }

  return totalInserted;
}

/**
 * Materialize lecture sessions for a single date.
 */
export async function ensureLectureSessionsForDate(
  collegeId: number,
  dateStr: string,
): Promise<number> {
  return ensureLectureSessionsForDateRange(collegeId, dateStr, dateStr);
}

// ======================== FACULTY'S LECTURES ========================

export async function getFacultyLectures(
  collegeId: number,
  userId: number,
  options?: { date?: string; isLocked?: boolean },
) {
  // If no date provided, default to current date in YYYY-MM-DD
  const dateStr = options?.date ?? new Date().toISOString().split("T")[0];

  // Materialize any recurring timetable slots for this date before querying
  await ensureLectureSessionsForDate(collegeId, dateStr);

  const { rows } = await pool.query(
    `SELECT ls.id, ls.timetable_slot_id, ls.session_date, ls.status,
            ls.is_locked, ls.locked_at, ls.locked_by,
            ts.period_no, ts.start_time, ts.end_time, ts.room,
            ts.subject_assignment_id,
            su.id AS subject_id, su.code AS subject_code, su.name AS subject_name,
            su.subject_type, su.is_elective,
            sec.id AS section_id, sec.name AS section_name,
            lg.id AS lab_group_id, lg.name AS lab_group_name,
            COUNT(a.id) AS attendance_count,
            COUNT(a.id) FILTER (WHERE a.status = 'present') AS present_count
       FROM lecture_session ls
       JOIN timetable_slot ts     ON ts.id = ls.timetable_slot_id
       JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
       JOIN subject su            ON su.id = sa.subject_id
       JOIN faculty f             ON f.id = sa.faculty_id
       JOIN section sec           ON sec.id = sa.section_id
       LEFT JOIN lab_group lg     ON lg.id = sa.lab_group_id
       JOIN department d          ON d.id = su.department_id
       LEFT JOIN attendance a     ON a.lecture_session_id = ls.id
      WHERE d.college_id = $1
        AND f.user_id = $2
        AND ls.session_date = $3::date
        AND ($4::boolean IS NULL OR ls.is_locked = $4)
      GROUP BY ls.id, ts.id, sa.id, su.id, sec.id, lg.id
      ORDER BY ts.period_no ASC, ts.start_time ASC`,
    [collegeId, userId, dateStr, options?.isLocked !== undefined ? options.isLocked : null],
  );
  return rows;
}

// ======================== SESSION DETAILS & ELIGIBLE STUDENTS ========================

export async function getSessionStudents(sessionId: number, collegeId: number) {
  // 1. Get session info
  const sessionRes = await pool.query(
    `SELECT ls.id, ls.session_date, ls.status, ls.is_locked, ls.locked_at, ls.locked_by,
            ts.id AS timetable_slot_id, ts.period_no, ts.start_time, ts.end_time, ts.room,
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

  if (sessionRes.rows.length === 0) return null;
  const session = sessionRes.rows[0];

  // 2. Fetch eligible students:
  // - Must belong to the section
  // - If assignment is for a lab group, student must belong to that lab group
  // - If subject is an elective, student must be enrolled in elective_enrollment
  const studentsRes = await pool.query(
    `SELECT s.id, s.roll_no, s.full_name, s.admission_year,
            s.section_id, s.lab_group_id, slg.name AS lab_group_name,
            a.id AS attendance_id, a.status AS attendance_status, a.marked_at
       FROM student s
       LEFT JOIN lab_group slg ON slg.id = s.lab_group_id
       LEFT JOIN attendance a  ON a.lecture_session_id = $1 AND a.student_id = s.id
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
      sessionId,
      session.section_id,
      session.lab_group_id ?? null,
      session.is_elective,
      session.subject_id,
      session.term_id,
    ],
  );

  return {
    session,
    students: studentsRes.rows,
  };
}

// ======================== SUBMIT ATTENDANCE ========================

export async function submitAttendance(
  sessionId: number,
  collegeId: number,
  userId: number,
  userRole: string,
  records: Array<{ student_id: number; status: "present" | "absent" }>,
  lockSession: boolean,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Verify session exists and check permission
    const sessionRes = await client.query(
      `SELECT ls.id, ls.status, ls.is_locked, f.user_id AS faculty_user_id
         FROM lecture_session ls
         JOIN timetable_slot ts     ON ts.id = ls.timetable_slot_id
         JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
         JOIN subject su            ON su.id = sa.subject_id
         JOIN faculty f             ON f.id = ts.faculty_id
         JOIN department d          ON d.id = su.department_id
        WHERE ls.id = $1 AND d.college_id = $2`,
      [sessionId, collegeId],
    );

    if (sessionRes.rows.length === 0) {
      throw Object.assign(new Error("Lecture session not found"), { status: 404 });
    }

    const session = sessionRes.rows[0];

    // Faculty can only submit attendance for their own sessions
    if (userRole === "faculty" && session.faculty_user_id !== userId) {
      throw Object.assign(
        new Error("Forbidden: You can only take attendance for your own lecture sessions"),
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

    // 2. Upsert each attendance record
    // The DB trigger trg_attendance_guard will verify session is not locked/cancelled
    for (const record of records) {
      await client.query(
        `INSERT INTO attendance (lecture_session_id, student_id, status, marked_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (lecture_session_id, student_id)
         DO UPDATE SET status = EXCLUDED.status, marked_at = now()`,
        [sessionId, record.student_id, record.status],
      );
    }

    // 3. Lock session if requested
    let lockedSession = null;
    if (lockSession) {
      // Trigger trg_lecture_session_guard will flip status to 'held' and set locked_at
      const lockRes = await client.query(
        `UPDATE lecture_session
            SET is_locked = true,
                locked_by = $2,
                locked_at = now()
          WHERE id = $1
          RETURNING id, timetable_slot_id, session_date, status, is_locked, locked_at, locked_by`,
        [sessionId, userId],
      );
      lockedSession = lockRes.rows[0];
    }

    await client.query("COMMIT");

    return {
      message: lockSession ? "Attendance submitted and lecture locked" : "Attendance saved",
      markedCount: records.length,
      session: lockedSession ?? session,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ======================== LOCK LECTURE SESSION ========================

export async function lockSession(
  sessionId: number,
  collegeId: number,
  userId: number,
  userRole: string,
) {
  // Check permission first
  const sessionRes = await pool.query(
    `SELECT ls.id, ls.status, ls.is_locked, f.user_id AS faculty_user_id
       FROM lecture_session ls
       JOIN timetable_slot ts     ON ts.id = ls.timetable_slot_id
       JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
       JOIN subject su            ON su.id = sa.subject_id
       JOIN faculty f             ON f.id = ts.faculty_id
       JOIN department d          ON d.id = su.department_id
      WHERE ls.id = $1 AND d.college_id = $2`,
    [sessionId, collegeId],
  );

  if (sessionRes.rows.length === 0) {
    throw Object.assign(new Error("Lecture session not found"), { status: 404 });
  }

  const session = sessionRes.rows[0];
  if (userRole === "faculty" && session.faculty_user_id !== userId) {
    throw Object.assign(
      new Error("Forbidden: You can only lock your own lecture sessions"),
      { status: 403 },
    );
  }

  // Trigger trg_lecture_session_guard enforces:
  // - Cannot lock cancelled lecture (exception -> 409/422)
  // - Sets status = 'held', locked_at = now()
  const { rows } = await pool.query(
    `UPDATE lecture_session
        SET is_locked = true,
            locked_by = $2,
            locked_at = now()
      WHERE id = $1
      RETURNING id, timetable_slot_id, session_date, status, is_locked, locked_at, locked_by`,
    [sessionId, userId],
  );

  return rows[0];
}
