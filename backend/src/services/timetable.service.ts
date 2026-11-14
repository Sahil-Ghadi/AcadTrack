import pool from "../config/db";
import { serializeToCsv } from "../utils/csv/csv-serializer";

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
            d.id AS department_id, d.name AS department_name,
            t.academic_year, t.term_type
       FROM timetable_slot ts
       JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
       JOIN subject su            ON su.id = sa.subject_id
       JOIN faculty f             ON f.id = ts.faculty_id
       JOIN section sec           ON sec.id = sa.section_id
       LEFT JOIN lab_group lg     ON lg.id = sa.lab_group_id
       JOIN department d          ON d.id = su.department_id
       JOIN academic_term t       ON t.id = ts.term_id
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
  departmentIdScope?: number,
) {
  // 1. Verify assignment belongs to this college and fetch assignment details
  const check = await pool.query(
    `SELECT sa.id, sa.faculty_id, sa.term_id, sa.section_id, sa.lab_group_id,
            su.code AS subject_code, sec.name AS section_name,
            f.full_name AS faculty_name, lg.name AS lab_group_name,
            d.id AS department_id
       FROM subject_assignment sa
       JOIN subject su        ON su.id = sa.subject_id
       JOIN department d      ON d.id = su.department_id
       JOIN section sec       ON sec.id = sa.section_id
       JOIN faculty f         ON f.id = sa.faculty_id
       LEFT JOIN lab_group lg ON lg.id = sa.lab_group_id
      WHERE sa.id = $1 AND d.college_id = $2`,
    [data.subject_assignment_id, collegeId],
  );
  if (check.rows.length === 0) {
    throw Object.assign(new Error("Subject assignment not found in this college"), { status: 404 });
  }

  const target = check.rows[0];
  if (departmentIdScope && target.department_id !== departmentIdScope) {
    throw Object.assign(new Error("Cannot schedule slots for another department"), { status: 403 });
  }

  // 2. Application-level interval conflict detection
  // Query all overlapping slots in the same academic term and day of week
  const overlapCheck = await pool.query(
    `SELECT ts.id, ts.room, ts.faculty_id, ts.start_time, ts.end_time,
            sa.section_id, sa.lab_group_id,
            f.full_name AS faculty_name,
            su.code AS subject_code,
            lg.name AS lab_group_name
       FROM timetable_slot ts
       JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
       JOIN faculty f             ON f.id = ts.faculty_id
       JOIN subject su            ON su.id = sa.subject_id
       LEFT JOIN lab_group lg     ON lg.id = sa.lab_group_id
      WHERE ts.term_id = $1
        AND ts.day_of_week = $2
        AND ts.start_time < $4::time
        AND ts.end_time > $3::time`,
    [target.term_id, data.day_of_week, data.start_time, data.end_time],
  );

  for (const existing of overlapCheck.rows) {
    const existingStart = String(existing.start_time).slice(0, 5);
    const existingEnd = String(existing.end_time).slice(0, 5);

    // Rule 1: Faculty conflict
    if (Number(existing.faculty_id) === Number(target.faculty_id)) {
      throw Object.assign(
        new Error(
          `Faculty clash: ${existing.faculty_name} is already scheduled from ${existingStart} to ${existingEnd}`,
        ),
        { status: 409 },
      );
    }

    // Rule 2: Room conflict
    if (existing.room.trim().toLowerCase() === data.room.trim().toLowerCase()) {
      throw Object.assign(
        new Error(
          `Room clash: Room ${existing.room} is already occupied from ${existingStart} to ${existingEnd}`,
        ),
        { status: 409 },
      );
    }

    // Rule 3, 4, 5: Section and Lab Group conflicts
    if (Number(existing.section_id) === Number(target.section_id)) {
      // 3a. Both are whole section (lab_group_id is null)
      if (!existing.lab_group_id && !target.lab_group_id) {
        throw Object.assign(
          new Error(
            `Section clash: Section ${target.section_name} is already scheduled for lecture (${existing.subject_code}) from ${existingStart} to ${existingEnd}`,
          ),
          { status: 409 },
        );
      }

      // 3b. Whole section vs lab group
      if (
        (!existing.lab_group_id && target.lab_group_id) ||
        (existing.lab_group_id && !target.lab_group_id)
      ) {
        throw Object.assign(
          new Error(
            `Section clash: Cannot schedule concurrent whole-section lecture and lab group for Section ${target.section_name} from ${existingStart} to ${existingEnd}`,
          ),
          { status: 409 },
        );
      }

      // 3c. Same lab group conflict
      if (
        existing.lab_group_id &&
        target.lab_group_id &&
        Number(existing.lab_group_id) === Number(target.lab_group_id)
      ) {
        throw Object.assign(
          new Error(
            `Lab group clash: Lab Group ${existing.lab_group_name || target.lab_group_name} is already scheduled from ${existingStart} to ${existingEnd}`,
          ),
          { status: 409 },
        );
      }

      // Permitted concurrency: existing.lab_group_id !== target.lab_group_id
      // (concurrent labs in different rooms with different faculty are allowed)
    }
  }

  // 3. Insert slot (Trigger trg_slot_fill and trg_timetable_slot_clash_guard will also validate)
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

export async function updateSlot(
  slotId: number,
  collegeId: number,
  data: {
    subject_assignment_id?: number;
    day_of_week?: number;
    period_no?: number;
    start_time?: string;
    end_time?: string;
    room?: string;
  },
  departmentIdScope?: number,
) {
  // 1. Fetch existing slot and verify it belongs to this college (and scoped department)
  const existingRes = await pool.query(
    `SELECT ts.id, ts.subject_assignment_id, ts.day_of_week, ts.period_no,
            ts.start_time, ts.end_time, ts.room, ts.term_id, ts.faculty_id,
            sa.section_id, sa.lab_group_id,
            d.id AS department_id, d.name AS department_name
       FROM timetable_slot ts
       JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
       JOIN subject su            ON su.id = sa.subject_id
       JOIN department d          ON d.id = su.department_id
      WHERE ts.id = $1 AND d.college_id = $2`,
    [slotId, collegeId],
  );

  if (existingRes.rows.length === 0) {
    throw Object.assign(new Error("Timetable slot not found"), { status: 404 });
  }

  const existingSlot = existingRes.rows[0];
  if (departmentIdScope && existingSlot.department_id !== departmentIdScope) {
    throw Object.assign(
      new Error("Cannot modify timetable slots belonging to another department"),
      { status: 403 },
    );
  }

  // 2. Determine target values (merged with existing)
  const targetAssignmentId = data.subject_assignment_id ?? Number(existingSlot.subject_assignment_id);
  const targetDayOfWeek = data.day_of_week ?? existingSlot.day_of_week;
  const targetPeriodNo = data.period_no ?? existingSlot.period_no;
  const targetStartTime = data.start_time ?? String(existingSlot.start_time).slice(0, 5);
  const targetEndTime = data.end_time ?? String(existingSlot.end_time).slice(0, 5);
  const targetRoom = data.room ?? existingSlot.room;

  if (targetStartTime >= targetEndTime) {
    throw Object.assign(new Error("Slot end_time must be after start_time"), { status: 400 });
  }

  // 3. Fetch target subject assignment details
  const saCheck = await pool.query(
    `SELECT sa.id, sa.faculty_id, sa.term_id, sa.section_id, sa.lab_group_id,
            su.code AS subject_code, sec.name AS section_name,
            f.full_name AS faculty_name, lg.name AS lab_group_name,
            d.id AS department_id
       FROM subject_assignment sa
       JOIN subject su        ON su.id = sa.subject_id
       JOIN department d      ON d.id = su.department_id
       JOIN section sec       ON sec.id = sa.section_id
       JOIN faculty f         ON f.id = sa.faculty_id
       LEFT JOIN lab_group lg ON lg.id = sa.lab_group_id
      WHERE sa.id = $1 AND d.college_id = $2`,
    [targetAssignmentId, collegeId],
  );

  if (saCheck.rows.length === 0) {
    throw Object.assign(new Error("Subject assignment not found in this college"), { status: 404 });
  }

  const targetSa = saCheck.rows[0];
  if (departmentIdScope && targetSa.department_id !== departmentIdScope) {
    throw Object.assign(
      new Error("Cannot assign to a subject belonging to another department"),
      { status: 403 },
    );
  }

  // 4. Application-level clash detection (EXCLUDING this slot id: ts.id <> $5 so it doesn't self-conflict)
  const overlapCheck = await pool.query(
    `SELECT ts.id, ts.room, ts.faculty_id, ts.start_time, ts.end_time,
            sa.section_id, sa.lab_group_id,
            f.full_name AS faculty_name,
            su.code AS subject_code,
            lg.name AS lab_group_name
       FROM timetable_slot ts
       JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
       JOIN faculty f             ON f.id = ts.faculty_id
       JOIN subject su            ON su.id = sa.subject_id
       LEFT JOIN lab_group lg     ON lg.id = sa.lab_group_id
      WHERE ts.term_id = $1
        AND ts.day_of_week = $2
        AND ts.start_time < $4::time
        AND ts.end_time > $3::time
        AND ts.id <> $5`,
    [targetSa.term_id, targetDayOfWeek, targetStartTime, targetEndTime, slotId],
  );

  for (const existing of overlapCheck.rows) {
    const existingStart = String(existing.start_time).slice(0, 5);
    const existingEnd = String(existing.end_time).slice(0, 5);

    // Rule 1: Faculty conflict
    if (Number(existing.faculty_id) === Number(targetSa.faculty_id)) {
      throw Object.assign(
        new Error(
          `Faculty clash: ${existing.faculty_name} is already scheduled from ${existingStart} to ${existingEnd}`,
        ),
        { status: 409 },
      );
    }

    // Rule 2: Room conflict
    if (existing.room.trim().toLowerCase() === targetRoom.trim().toLowerCase()) {
      throw Object.assign(
        new Error(
          `Room clash: Room ${existing.room} is already occupied from ${existingStart} to ${existingEnd}`,
        ),
        { status: 409 },
      );
    }

    // Rule 3, 4, 5: Section and Lab Group conflicts
    if (Number(existing.section_id) === Number(targetSa.section_id)) {
      // 3a. Both are whole section (lab_group_id is null)
      if (!existing.lab_group_id && !targetSa.lab_group_id) {
        throw Object.assign(
          new Error(
            `Section clash: Section ${targetSa.section_name} is already scheduled for lecture (${existing.subject_code}) from ${existingStart} to ${existingEnd}`,
          ),
          { status: 409 },
        );
      }

      // 3b. Whole section vs lab group
      if (
        (!existing.lab_group_id && targetSa.lab_group_id) ||
        (existing.lab_group_id && !targetSa.lab_group_id)
      ) {
        throw Object.assign(
          new Error(
            `Section clash: Cannot schedule concurrent whole-section lecture and lab group for Section ${targetSa.section_name} from ${existingStart} to ${existingEnd}`,
          ),
          { status: 409 },
        );
      }

      // 3c. Same lab group conflict
      if (
        existing.lab_group_id &&
        targetSa.lab_group_id &&
        Number(existing.lab_group_id) === Number(targetSa.lab_group_id)
      ) {
        throw Object.assign(
          new Error(
            `Lab group clash: Lab Group ${existing.lab_group_name || targetSa.lab_group_name} is already scheduled from ${existingStart} to ${existingEnd}`,
          ),
          { status: 409 },
        );
      }

      // Permitted concurrency: existing.lab_group_id !== targetSa.lab_group_id
    }
  }

  // 5. Update slot in database (Trigger trg_timetable_slot_clash_guard also guards with advisory lock)
  const { rows } = await pool.query(
    `UPDATE timetable_slot
        SET subject_assignment_id = $1,
            faculty_id = $2,
            term_id = $3,
            day_of_week = $4,
            period_no = $5,
            start_time = $6::time,
            end_time = $7::time,
            room = $8
      WHERE id = $9
      RETURNING id, subject_assignment_id, faculty_id, term_id, day_of_week, period_no, start_time, end_time, room`,
    [
      targetAssignmentId,
      targetSa.faculty_id,
      targetSa.term_id,
      targetDayOfWeek,
      targetPeriodNo,
      targetStartTime,
      targetEndTime,
      targetRoom,
      slotId,
    ],
  );

  return rows[0];
}

export async function exportSlotsCsv(
  collegeId: number,
  options?: {
    termId?: number;
    departmentId?: number;
  },
): Promise<string> {
  // If departmentId is specified, verify it strictly belongs to this authenticated college
  if (options?.departmentId) {
    const deptCheck = await pool.query(
      `SELECT id FROM department WHERE id = $1 AND college_id = $2`,
      [options.departmentId, collegeId],
    );
    if (deptCheck.rows.length === 0) {
      throw Object.assign(new Error("Department not found in this college"), { status: 404 });
    }
  }

  // If termId is specified, verify it strictly belongs to this authenticated college
  if (options?.termId) {
    const termCheck = await pool.query(
      `SELECT id FROM academic_term WHERE id = $1 AND college_id = $2`,
      [options.termId, collegeId],
    );
    if (termCheck.rows.length === 0) {
      throw Object.assign(new Error("Academic term not found in this college"), { status: 404 });
    }
  }
  const { rows } = await pool.query(
    `SELECT ts.id, ts.day_of_week, ts.period_no, ts.start_time, ts.end_time, ts.room,
            su.code AS subject_code, su.name AS subject_name, su.subject_type,
            f.full_name AS faculty_name, f.employee_code,
            d.name AS department_name,
            t.academic_year, t.term_type,
            sec.name AS section_name,
            lg.name AS lab_group_name
       FROM timetable_slot ts
       JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
       JOIN subject su            ON su.id = sa.subject_id
       JOIN faculty f             ON f.id = ts.faculty_id
       JOIN section sec           ON sec.id = sa.section_id
       LEFT JOIN lab_group lg     ON lg.id = sa.lab_group_id
       JOIN department d          ON d.id = su.department_id
       JOIN academic_term t       ON t.id = ts.term_id
      WHERE d.college_id = $1
        AND ($2::bigint IS NULL OR ts.term_id = $2)
        AND ($3::bigint IS NULL OR d.id = $3)
      ORDER BY ts.day_of_week, ts.period_no, sec.name, lg.name NULLS FIRST`,
    [collegeId, options?.termId ?? null, options?.departmentId ?? null],
  );

  const dayNames: Record<number, string> = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday",
  };

  const headers = [
    "Subject Code",
    "Subject Name",
    "Subject Type",
    "Faculty Name",
    "Faculty Code",
    "Department",
    "Academic Year",
    "Term Type",
    "Section",
    "Lab Group",
    "Day",
    "Period",
    "Start Time",
    "End Time",
    "Room",
  ];

  const csvRows = rows.map((r) => [
    r.subject_code,
    r.subject_name,
    r.subject_type,
    r.faculty_name,
    r.employee_code,
    r.department_name,
    r.academic_year,
    r.term_type,
    r.section_name,
    r.lab_group_name ?? "",
    dayNames[r.day_of_week] || String(r.day_of_week),
    r.period_no,
    String(r.start_time).slice(0, 5),
    String(r.end_time).slice(0, 5),
    r.room,
  ]);

  return serializeToCsv(headers, csvRows);
}

export async function deleteSlot(slotId: number, collegeId: number, departmentIdScope?: number) {
  const { rowCount } = await pool.query(
    `DELETE FROM timetable_slot ts
      USING subject_assignment sa, subject su, department d
      WHERE ts.id = $1
        AND sa.id = ts.subject_assignment_id
        AND su.id = sa.subject_id
        AND d.id = su.department_id
        AND d.college_id = $2
        AND ($3::bigint IS NULL OR d.id = $3)`,
    [slotId, collegeId, departmentIdScope ?? null],
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
