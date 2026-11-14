-- =====================================================================
-- AcadTrack : sample data (all illustrative)
-- Run AFTER schema.sql:  psql -U postgres -d acadtrack -f db/seed.sql
-- Every demo account uses the password:  Password@123
-- =====================================================================

BEGIN;

-- Institution ---------------------------------------------------------
INSERT INTO college (name, code, address) VALUES
    ('Demo College of Engineering', 'DCE', 'Goa, India');

INSERT INTO settings (college_id, attendance_threshold)
    SELECT id, 75.00 FROM college WHERE code = 'DCE';

INSERT INTO department (college_id, name, code)
    SELECT id, 'Computer Engineering', 'CO' FROM college WHERE code = 'DCE';

INSERT INTO program (department_id, name, level, duration_years)
    SELECT id, 'Computer Engineering', 'B.E.', 4 FROM department WHERE code = 'CO';

INSERT INTO batch (program_id, start_year, end_year)
    SELECT id, 2024, 2028 FROM program WHERE name = 'Computer Engineering';

INSERT INTO section (batch_id, name)
    SELECT b.id, s.n FROM batch b, (VALUES ('A'), ('B')) AS s(n) WHERE b.start_year = 2024;

INSERT INTO lab_group (section_id, name)
    SELECT sec.id, g.n FROM section sec, (VALUES ('A1'), ('A2')) AS g(n) WHERE sec.name = 'A';

INSERT INTO academic_term (college_id, academic_year, term_type, start_date, end_date, is_current)
    SELECT id, '2026-2027', 'odd', DATE '2026-07-20', DATE '2026-11-30', true
    FROM college WHERE code = 'DCE';

-- Users (password for all: Password@123) -------------------------------
INSERT INTO app_user (college_id, department_id, email, password_hash, role)
SELECT c.id,
       CASE WHEN v.role = 'college_admin' THEN NULL ELSE d.id END,
       v.email,
       '$2b$10$28YvRl.PPJnu6buFgZ/dHuGhqBTHAvPPMZy8s7ny.TANm709.RDxC',
       v.role
FROM college c
JOIN department d ON d.college_id = c.id AND d.code = 'CO',
(VALUES
    ('admin@acadtrack.test',      'college_admin'),
    ('hod.co@acadtrack.test',     'dept_admin'),
    ('faculty1@acadtrack.test',   'faculty'),
    ('faculty2@acadtrack.test',   'faculty'),
    ('faculty3@acadtrack.test',   'faculty'),
    ('sahil@acadtrack.test',      'student'),
    ('pratham@acadtrack.test',    'student'),
    ('sanjeet@acadtrack.test',    'student'),
    ('aarav@acadtrack.test',      'student'),
    ('diya@acadtrack.test',       'student'),
    ('rohan@acadtrack.test',      'student')
) AS v(email, role)
WHERE c.code = 'DCE';

INSERT INTO faculty (user_id, department_id, employee_code, full_name, designation)
SELECT u.id, d.id, v.code, v.nm, v.des
FROM (VALUES
    ('faculty1@acadtrack.test', 'EMP101', 'Dr. Meera Kulkarni', 'Associate Professor'),
    ('faculty2@acadtrack.test', 'EMP102', 'Prof. Anil Desai',   'Assistant Professor'),
    ('faculty3@acadtrack.test', 'EMP103', 'Prof. Neha Prabhu',  'Assistant Professor')
) AS v(email, code, nm, des)
JOIN app_user u ON u.email = v.email
JOIN department d ON d.code = 'CO';

INSERT INTO student (user_id, section_id, lab_group_id, roll_no, full_name, admission_year)
SELECT u.id,
       (SELECT id FROM section WHERE name = 'A'),
       (SELECT id FROM lab_group WHERE name = v.lg),
       v.roll, v.nm, 2024
FROM (VALUES
    ('sahil@acadtrack.test',   '24B-CO-049', 'Sahil Ghadi',        'A1'),
    ('pratham@acadtrack.test', '24B-CO-045', 'Pratham Honawarkar', 'A1'),
    ('sanjeet@acadtrack.test', '24B-CO-056', 'Sanjeet Ghadi',      'A2'),
    ('aarav@acadtrack.test',   '24B-CO-001', 'Aarav Naik',         'A1'),
    ('diya@acadtrack.test',    '24B-CO-012', 'Diya Kamat',         'A2'),
    ('rohan@acadtrack.test',   '24B-CO-023', 'Rohan Fernandes',    'A2')
) AS v(email, roll, nm, lg)
JOIN app_user u ON u.email = v.email;

-- Subjects (semester 5) ------------------------------------------------
INSERT INTO subject (department_id, code, name, subject_type, semester, is_elective)
SELECT d.id, v.code, v.nm, 'theory', 5, v.el
FROM department d,
(VALUES
    ('CO501', 'Database Management Systems', false),
    ('CO502', 'Operating Systems',            false),
    ('CO503', 'Computer Networks',            false),
    ('CO5E1', 'Cloud Computing (Elective)',   true)
) AS v(code, nm, el)
WHERE d.code = 'CO';

-- Who teaches what (Section A, current term) ---------------------------
INSERT INTO subject_assignment (subject_id, faculty_id, section_id, term_id)
SELECT su.id, f.id, (SELECT id FROM section WHERE name = 'A'), (SELECT id FROM academic_term WHERE is_current)
FROM (VALUES
    ('CO501', 'EMP101'), ('CO502', 'EMP102'), ('CO503', 'EMP103'), ('CO5E1', 'EMP101')
) AS v(scode, ecode)
JOIN subject su ON su.code = v.scode
JOIN faculty f  ON f.employee_code = v.ecode;

-- Two students opt for the elective
INSERT INTO elective_enrollment (student_id, subject_id, term_id)
SELECT s.id, (SELECT id FROM subject WHERE code = 'CO5E1'), (SELECT id FROM academic_term WHERE is_current)
FROM student s WHERE s.roll_no IN ('24B-CO-049', '24B-CO-045');

-- Weekly timetable (1 = Monday) ----------------------------------------
INSERT INTO timetable_slot (subject_assignment_id, day_of_week, period_no, start_time, end_time, room)
SELECT sa.id, v.dow, v.per, v.st::time, v.en::time, v.room
FROM (VALUES
    ('CO501', 1, 1, '09:00', '10:00', 'R204'),
    ('CO501', 3, 2, '10:00', '11:00', 'R204'),
    ('CO502', 1, 2, '10:00', '11:00', 'R204'),
    ('CO502', 2, 1, '09:00', '10:00', 'R204'),
    ('CO502', 4, 1, '09:00', '10:00', 'R204'),
    ('CO503', 2, 2, '10:00', '11:00', 'R204'),
    ('CO503', 4, 2, '10:00', '11:00', 'R204'),
    ('CO5E1', 5, 3, '11:15', '12:15', 'R305')
) AS v(scode, dow, per, st, en, room)
JOIN subject su ON su.code = v.scode
JOIN subject_assignment sa ON sa.subject_id = su.id;

-- Lecture sessions from 3 Aug to 31 Oct 2026 ----------------------------
INSERT INTO lecture_session (timetable_slot_id, session_date)
SELECT ts.id, d::date
FROM timetable_slot ts,
     generate_series(DATE '2026-08-03', DATE '2026-10-31', INTERVAL '1 day') AS d
WHERE EXTRACT(ISODOW FROM d::date) = ts.day_of_week;

-- Cancel one lecture (excluded from attendance %)
UPDATE lecture_session SET status = 'cancelled'
WHERE id = (SELECT MIN(id) FROM lecture_session WHERE session_date >= DATE '2026-09-07');

-- Attendance for every past lecture (deterministic pattern, varied per student)
INSERT INTO attendance (lecture_session_id, student_id, status)
SELECT ls.id, st.id,
       CASE WHEN ((ls.id * 37 + st.id * 91) % 100) < (95 - (st.id * 9) % 40)
            THEN 'present' ELSE 'absent' END
FROM lecture_session ls
JOIN timetable_slot ts      ON ts.id = ls.timetable_slot_id
JOIN subject_assignment sa  ON sa.id = ts.subject_assignment_id
JOIN subject su             ON su.id = sa.subject_id
JOIN student st             ON st.section_id = sa.section_id
WHERE ls.session_date < DATE '2026-10-01'
  AND ls.status = 'scheduled'
  AND (NOT su.is_elective OR EXISTS (
        SELECT 1 FROM elective_enrollment ee
        WHERE ee.student_id = st.id AND ee.subject_id = su.id AND ee.term_id = sa.term_id));

-- Lock past lectures (trigger flips them to 'held'); October ones stay open
UPDATE lecture_session ls
SET is_locked = true, locked_by = f.user_id
FROM timetable_slot ts
JOIN subject_assignment sa ON sa.id = ts.subject_assignment_id
JOIN faculty f             ON f.id = sa.faculty_id
WHERE ts.id = ls.timetable_slot_id
  AND ls.session_date < DATE '2026-10-01'
  AND ls.status = 'scheduled';

-- Marks: IT1, IT2 and Assignment entered; IT3 still pending -------------
INSERT INTO marks (student_id, subject_assignment_id, component, marks_obtained, entered_by)
SELECT st.id, sa.id, c.comp,
       LEAST(CASE WHEN c.comp = 'ASSIGNMENT' THEN su.max_assignment_marks ELSE su.max_it_marks END,
             ROUND(CASE WHEN c.comp = 'ASSIGNMENT' THEN su.max_assignment_marks ELSE su.max_it_marks END
                   * (0.45 + ((st.id * 13 + sa.id * 7 + c.n * 5) % 50) / 100.0), 1)),
       sa.faculty_id
FROM student st
JOIN subject_assignment sa ON sa.section_id = st.section_id
JOIN subject su            ON su.id = sa.subject_id AND NOT su.is_elective,
(VALUES ('IT1', 1), ('IT2', 2), ('ASSIGNMENT', 3)) AS c(comp, n);

COMMIT;
