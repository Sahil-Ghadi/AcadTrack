ACADTRACK ROLE-BASED IMPORT SUITE
=================================

All records are fictional. Emails use @acadtrack.test. No real personal data is included.

WHAT IS INCLUDED
----------------
College Admin:
  01_COLLEGE_ADMIN_faculty_computer_engineering.csv  (8 faculty)
  02_COLLEGE_ADMIN_students_section_A.csv            (60 students, Section A)

HOD / Department Admin:
  03_HOD_faculty_computer_engineering.csv             (5 additional faculty)
  04_HOD_students_section_B.csv                       (60 students, Section B)

Faculty:
  05_FACULTY_marks_section_A_IT1.csv                  (60 marks)
  05_FACULTY_marks_section_A_IT2.csv                  (60 marks)
  05_FACULTY_marks_section_A_IT3.csv                  (60 marks)
  05_FACULTY_marks_section_A_Assignment.csv           (60 marks)
  06_FACULTY_attendance_section_A_session.csv         (60 attendance statuses)
  07_FACULTY_marks_section_B_<component>.csv          (60 marks per component)
  08_FACULTY_attendance_section_B_session.csv         (60 attendance statuses)

IMPORTANT CURRENT-APP ASSUMPTIONS
---------------------------------
1. These import files target the existing Computer Engineering department.
2. The department name must match exactly: Computer Engineering.
3. Sections A and B must already exist in that department. The current screenshots showed
   two active sections, but confirm the section labels in the app before importing.
4. Student import required fields are roll_number, name, email, section, admission_year.
   Program, batch and lab_group are intentionally omitted to avoid references to entities
   that may not exist in the current database.
5. Faculty import required fields are employee_code, name, email, department.
6. College Admin and HOD can import student/faculty records using their respective scoped
   import screens. HOD import must be performed while logged into the target department.
7. This pack does NOT create departments, HOD/admin login accounts, subject assignments,
   lecture sessions, or faculty-subject ownership. Those must already exist in the app.

FACULTY MARKS IMPORT
--------------------
The marks CSV header is exactly:
  Roll No,Student Name,Marks

For each import:
- Open Internal Marks Entry.
- Select the subject assigned to the logged-in faculty member.
- Select IT1, IT2, IT3 or Assignment to match the filename.
- Import the corresponding CSV.
- The marks are within the assumed limits: IT1/IT2/IT3 <= 20, Assignment <= 10.

The marks are associated with the subject and assessment selected in the UI, not by CSV columns.
Use the Section A files only when the selected subject's roster includes the imported Section A
students. Use Section B files only for a subject assigned to Section B.

FACULTY ATTENDANCE IMPORT
-------------------------
The attendance CSV header is:
  Roll No,Student Name,Attendance

Values are Present or Absent. Import it only after selecting an existing lecture session
owned by the logged-in faculty member and whose roster includes the corresponding section.
Section A and Section B files are separate.

RECOMMENDED IMPORT ORDER
------------------------
1. College Admin imports 01 and 02.
2. HOD imports 03 and 04 (only if Section B exists).
3. Verify the students and faculty appear in the relevant admin screens.
4. Faculty imports marks for each assessment, selecting the correct subject each time.
5. Faculty imports attendance against an existing matching lecture session.
6. Log out/in and restart the app to confirm persistence.

DUPLICATE SAFETY
----------------
Every roll number, employee code and email in this pack is unique and prefixed/namespaced for
demo use. Do not import the same file twice unless the UI explicitly supports safe upsert and
you intend to update existing rows.
