-- =====================================================================
-- AcadTrack : PostgreSQL schema
-- Run:  psql -U postgres -d acadtrack -f db/schema.sql
-- Safe to re-run: it drops and recreates everything (development only!)
-- =====================================================================

BEGIN;

DROP VIEW  IF EXISTS v_marks_summary, v_attendance_summary CASCADE;
DROP TABLE IF EXISTS marks, attendance, lecture_session, timetable_slot,
                     elective_enrollment, subject_assignment, subject,
                     faculty, student, app_user, settings, academic_term,
                     lab_group, section, batch, program, department, college CASCADE;
DROP FUNCTION IF EXISTS trg_attendance_guard(), trg_lecture_session_guard(),
                        trg_marks_guard(), trg_slot_fill(), trg_elective_guard() CASCADE;

-- ---------------------------------------------------------------------
-- 1. Institution hierarchy
-- ---------------------------------------------------------------------
CREATE TABLE college (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       varchar(150) NOT NULL,
    code       varchar(20)  NOT NULL UNIQUE,
    address    text,
    is_active  boolean NOT NULL DEFAULT true
);

CREATE TABLE department (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    college_id  bigint NOT NULL REFERENCES college(id),
    name        varchar(100) NOT NULL,
    code        varchar(10)  NOT NULL,
    is_active   boolean NOT NULL DEFAULT true,
    UNIQUE (college_id, code)
);

CREATE TABLE program (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id   bigint NOT NULL REFERENCES department(id),
    name            varchar(100) NOT NULL,
    level           varchar(10)  NOT NULL CHECK (level IN ('B.E.', 'M.E.')),
    duration_years  smallint     NOT NULL CHECK (duration_years BETWEEN 1 AND 6),
    is_active       boolean NOT NULL DEFAULT true,
    UNIQUE (department_id, name, level)
);

CREATE TABLE batch (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    program_id  bigint NOT NULL REFERENCES program(id),
    start_year  smallint NOT NULL,
    end_year    smallint NOT NULL,
    is_active   boolean NOT NULL DEFAULT true,
    CHECK (end_year > start_year),
    UNIQUE (program_id, start_year)
);

CREATE TABLE section (
    id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_id  bigint NOT NULL REFERENCES batch(id),
    name      varchar(10) NOT NULL,
    UNIQUE (batch_id, name)
);

CREATE TABLE lab_group (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    section_id  bigint NOT NULL REFERENCES section(id),
    name        varchar(10) NOT NULL,
    UNIQUE (section_id, name),
    UNIQUE (id, section_id)          -- lets other tables prove "lab group belongs to this section"
);

CREATE TABLE academic_term (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    college_id     bigint NOT NULL REFERENCES college(id),
    academic_year  varchar(9) NOT NULL,                     -- e.g. 2026-2027
    term_type      varchar(10) NOT NULL CHECK (term_type IN ('odd', 'even')),
    start_date     date NOT NULL,
    end_date       date NOT NULL,
    is_current     boolean NOT NULL DEFAULT false,
    CHECK (end_date > start_date),
    UNIQUE (college_id, academic_year, term_type)
);
-- at most one current term per college
CREATE UNIQUE INDEX uq_one_current_term ON academic_term (college_id) WHERE is_current;

CREATE TABLE settings (
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    college_id            bigint NOT NULL UNIQUE REFERENCES college(id),
    attendance_threshold  numeric(5,2) NOT NULL DEFAULT 75.00
                          CHECK (attendance_threshold BETWEEN 0 AND 100)
);

-- ---------------------------------------------------------------------
-- 2. People
-- ---------------------------------------------------------------------
CREATE TABLE app_user (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    college_id     bigint NOT NULL REFERENCES college(id),
    department_id  bigint REFERENCES department(id),
    email          varchar(150) NOT NULL UNIQUE,
    password_hash  varchar(255) NOT NULL,
    role           varchar(20)  NOT NULL
                   CHECK (role IN ('college_admin', 'dept_admin', 'faculty', 'student')),
    is_active      boolean NOT NULL DEFAULT true,       -- deactivate, never delete
    created_at     timestamptz NOT NULL DEFAULT now(),
    CHECK (role <> 'dept_admin' OR department_id IS NOT NULL)
);

CREATE TABLE student (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         bigint NOT NULL UNIQUE REFERENCES app_user(id),
    section_id      bigint NOT NULL REFERENCES section(id),
    lab_group_id    bigint,
    roll_no         varchar(20)  NOT NULL UNIQUE,
    full_name       varchar(100) NOT NULL,
    admission_year  smallint NOT NULL,
    FOREIGN KEY (lab_group_id, section_id) REFERENCES lab_group (id, section_id)
);

CREATE TABLE faculty (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        bigint NOT NULL UNIQUE REFERENCES app_user(id),
    department_id  bigint NOT NULL REFERENCES department(id),
    employee_code  varchar(20)  NOT NULL UNIQUE,
    full_name      varchar(100) NOT NULL,
    designation    varchar(50)
);

-- ---------------------------------------------------------------------
-- 3. Teaching setup
-- ---------------------------------------------------------------------
CREATE TABLE subject (
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id         bigint NOT NULL REFERENCES department(id),
    code                  varchar(20)  NOT NULL UNIQUE,
    name                  varchar(120) NOT NULL,
    subject_type          varchar(10)  NOT NULL CHECK (subject_type IN ('theory', 'lab')),
    semester              smallint     NOT NULL CHECK (semester BETWEEN 1 AND 12),
    is_elective           boolean NOT NULL DEFAULT false,
    max_it_marks          numeric(5,2) NOT NULL DEFAULT 20 CHECK (max_it_marks > 0),
    max_assignment_marks  numeric(5,2) NOT NULL DEFAULT 10 CHECK (max_assignment_marks > 0),
    is_active             boolean NOT NULL DEFAULT true
);

CREATE TABLE subject_assignment (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_id    bigint NOT NULL REFERENCES subject(id),
    faculty_id    bigint NOT NULL REFERENCES faculty(id),
    section_id    bigint NOT NULL REFERENCES section(id),
    lab_group_id  bigint,
    term_id       bigint NOT NULL REFERENCES academic_term(id),
    FOREIGN KEY (lab_group_id, section_id) REFERENCES lab_group (id, section_id)
);
-- one teacher-slot per subject/section/lab-group/term (COALESCE because NULLs are never equal)
CREATE UNIQUE INDEX uq_subject_assignment
    ON subject_assignment (subject_id, section_id, term_id, COALESCE(lab_group_id, 0));

CREATE TABLE elective_enrollment (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id  bigint NOT NULL REFERENCES student(id),
    subject_id  bigint NOT NULL REFERENCES subject(id),
    term_id     bigint NOT NULL REFERENCES academic_term(id),
    UNIQUE (student_id, subject_id, term_id)
);

-- ---------------------------------------------------------------------
-- 4. Timetable, lectures, attendance, marks
-- ---------------------------------------------------------------------
CREATE TABLE timetable_slot (
    id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_assignment_id  bigint NOT NULL REFERENCES subject_assignment(id),
    faculty_id             bigint NOT NULL REFERENCES faculty(id),       -- filled by trigger
    term_id                bigint NOT NULL REFERENCES academic_term(id), -- filled by trigger
    day_of_week            smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 6),  -- 1 = Monday
    period_no              smallint NOT NULL CHECK (period_no BETWEEN 1 AND 12),
    start_time             time NOT NULL,
    end_time               time NOT NULL,
    room                   varchar(20) NOT NULL,
    CHECK (end_time > start_time),
    -- clash prevention
    UNIQUE (term_id, day_of_week, period_no, room),
    UNIQUE (term_id, day_of_week, period_no, faculty_id)
);

CREATE TABLE lecture_session (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timetable_slot_id bigint NOT NULL REFERENCES timetable_slot(id),
    session_date     date NOT NULL,
    status           varchar(12) NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled', 'held', 'cancelled')),
    is_locked        boolean NOT NULL DEFAULT false,
    locked_at        timestamptz,
    locked_by        bigint REFERENCES app_user(id),
    UNIQUE (timetable_slot_id, session_date),
    CHECK (NOT is_locked OR locked_at IS NOT NULL)
);

CREATE TABLE attendance (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lecture_session_id  bigint NOT NULL REFERENCES lecture_session(id),
    student_id          bigint NOT NULL REFERENCES student(id),
    status              varchar(10) NOT NULL CHECK (status IN ('present', 'absent')),
    marked_at           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (lecture_session_id, student_id)
);

CREATE TABLE marks (
    id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id             bigint NOT NULL REFERENCES student(id),
    subject_assignment_id  bigint NOT NULL REFERENCES subject_assignment(id),
    component              varchar(12) NOT NULL
                           CHECK (component IN ('IT1', 'IT2', 'IT3', 'ASSIGNMENT')),
    marks_obtained         numeric(5,2) NOT NULL CHECK (marks_obtained >= 0),
    entered_by             bigint NOT NULL REFERENCES faculty(id),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    UNIQUE (student_id, subject_assignment_id, component)
);

-- ---------------------------------------------------------------------
-- 5. Indexes for common lookups
-- ---------------------------------------------------------------------
CREATE INDEX ix_student_section        ON student (section_id);
CREATE INDEX ix_assignment_faculty     ON subject_assignment (faculty_id, term_id);
CREATE INDEX ix_assignment_section     ON subject_assignment (section_id, term_id);
CREATE INDEX ix_session_date           ON lecture_session (session_date);
CREATE INDEX ix_attendance_student     ON attendance (student_id);
CREATE INDEX ix_marks_assignment       ON marks (subject_assignment_id);

-- ---------------------------------------------------------------------
-- 6. Triggers (business rules enforced by the database itself)
-- ---------------------------------------------------------------------

-- 6.1 Timetable slot copies faculty and term from its subject assignment
CREATE FUNCTION trg_slot_fill() RETURNS trigger AS $$
BEGIN
    SELECT faculty_id, term_id INTO NEW.faculty_id, NEW.term_id
    FROM subject_assignment WHERE id = NEW.subject_assignment_id;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER slot_fill BEFORE INSERT OR UPDATE OF subject_assignment_id ON timetable_slot
    FOR EACH ROW EXECUTE FUNCTION trg_slot_fill();

-- 6.2 Only elective subjects can have elective enrollments
CREATE FUNCTION trg_elective_guard() RETURNS trigger AS $$
BEGIN
    IF NOT (SELECT is_elective FROM subject WHERE id = NEW.subject_id) THEN
        RAISE EXCEPTION 'Subject % is not an elective', NEW.subject_id;
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER elective_guard BEFORE INSERT OR UPDATE ON elective_enrollment
    FOR EACH ROW EXECUTE FUNCTION trg_elective_guard();

-- 6.3 Lecture session: locking is one-way; locking marks the lecture as held
CREATE FUNCTION trg_lecture_session_guard() RETURNS trigger AS $$
BEGIN
    IF OLD.is_locked THEN
        IF NOT NEW.is_locked OR NEW.status <> OLD.status
           OR NEW.session_date <> OLD.session_date
           OR NEW.timetable_slot_id <> OLD.timetable_slot_id THEN
            RAISE EXCEPTION 'Lecture % is locked and cannot be modified', OLD.id;
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.is_locked THEN                      -- being locked right now
        IF NEW.status = 'cancelled' THEN
            RAISE EXCEPTION 'A cancelled lecture cannot be locked';
        END IF;
        NEW.status    := 'held';
        NEW.locked_at := COALESCE(NEW.locked_at, now());
    END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER lecture_session_guard BEFORE UPDATE ON lecture_session
    FOR EACH ROW EXECUTE FUNCTION trg_lecture_session_guard();

-- 6.4 Attendance cannot change once its lecture is locked, or if cancelled
CREATE FUNCTION trg_attendance_guard() RETURNS trigger AS $$
DECLARE
    s record;
    sid bigint;
BEGIN
    sid := CASE WHEN TG_OP = 'DELETE' THEN OLD.lecture_session_id ELSE NEW.lecture_session_id END;
    SELECT is_locked, status INTO s FROM lecture_session WHERE id = sid;

    IF s.is_locked THEN
        RAISE EXCEPTION 'Attendance for lecture % is locked and cannot be changed', sid;
    END IF;
    IF TG_OP <> 'DELETE' AND s.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot mark attendance for a cancelled lecture';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_guard BEFORE INSERT OR UPDATE OR DELETE ON attendance
    FOR EACH ROW EXECUTE FUNCTION trg_attendance_guard();

-- 6.5 Marks cannot exceed the subject's maximum for that component
CREATE FUNCTION trg_marks_guard() RETURNS trigger AS $$
DECLARE
    mx numeric;
BEGIN
    SELECT CASE WHEN NEW.component = 'ASSIGNMENT' THEN s.max_assignment_marks
                ELSE s.max_it_marks END
      INTO mx
      FROM subject_assignment sa JOIN subject s ON s.id = sa.subject_id
     WHERE sa.id = NEW.subject_assignment_id;

    IF NEW.marks_obtained > mx THEN
        RAISE EXCEPTION '% marks (%) exceed the maximum of %', NEW.component, NEW.marks_obtained, mx;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER marks_guard BEFORE INSERT OR UPDATE ON marks
    FOR EACH ROW EXECUTE FUNCTION trg_marks_guard();

-- ---------------------------------------------------------------------
-- 7. Views: attendance % and eligibility are computed, never stored
-- ---------------------------------------------------------------------
-- Only HELD lectures count, so cancelled lectures are excluded automatically.
CREATE VIEW v_attendance_summary AS
SELECT a.student_id,
       ts.subject_assignment_id,
       sa.subject_id,
       COUNT(*)                                          AS total_lectures,
       COUNT(*) FILTER (WHERE a.status = 'present')      AS present_count,
       ROUND(100.0 * COUNT(*) FILTER (WHERE a.status = 'present') / COUNT(*), 2) AS attendance_pct,
       st.attendance_threshold,
       (100.0 * COUNT(*) FILTER (WHERE a.status = 'present') / COUNT(*))
           >= st.attendance_threshold                    AS is_eligible
FROM attendance a
JOIN lecture_session ls     ON ls.id = a.lecture_session_id AND ls.status = 'held'
JOIN timetable_slot ts      ON ts.id = ls.timetable_slot_id
JOIN subject_assignment sa  ON sa.id = ts.subject_assignment_id
JOIN subject su             ON su.id = sa.subject_id
JOIN department d           ON d.id  = su.department_id
JOIN settings st            ON st.college_id = d.college_id
GROUP BY a.student_id, ts.subject_assignment_id, sa.subject_id, st.attendance_threshold;

-- One row per student per subject with IT1 / IT2 / IT3 / Assignment side by side
CREATE VIEW v_marks_summary AS
SELECT m.student_id,
       m.subject_assignment_id,
       MAX(m.marks_obtained) FILTER (WHERE m.component = 'IT1')        AS it1,
       MAX(m.marks_obtained) FILTER (WHERE m.component = 'IT2')        AS it2,
       MAX(m.marks_obtained) FILTER (WHERE m.component = 'IT3')        AS it3,
       MAX(m.marks_obtained) FILTER (WHERE m.component = 'ASSIGNMENT') AS assignment
FROM marks m
GROUP BY m.student_id, m.subject_assignment_id;

COMMIT;
