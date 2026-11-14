# AcadTrack — Role-Based University Attendance, Internal Marks & Eligibility System

AcadTrack is a full-stack, role-based academic management system designed to eliminate spreadsheet fragmentation, retroactively editable attendance, and delayed exam eligibility checks in universities.

Built with **PostgreSQL**, **Express 5.x + TypeScript**, and **Next.js 16 (App Router) + Tailwind CSS**.

---

## 1. System Architecture

```text
               ┌────────────────────────────────────────────────────────┐
               │              Next.js 16 App Router (Port 3000)        │
               │   Tailwind CSS  •  Recharts  •  Role Dashboards       │
               └───────────▲──────────────────────────────▲────────────┘
                           │                              │
                httpOnly Session Cookie       Direct REST Client (JWT)
                           │                              │
               ┌───────────▼──────────────────────────────▼────────────┐
               │             Express 5 + TypeScript API (Port 5000)    │
               │    Routes -> Auth Middleware -> Controllers (Zod)     │
               │         -> Services (Parameterized SQL)               │
               └───────────────────────────▲────────────────────────────┘
                                           │
                              pg Pool (Parameterized SQL)
                                           │
               ┌───────────────────────────▼────────────────────────────┐
               │                     PostgreSQL Database                │
               │    18 Tables • 5 Triggers • 2 Views • Strict Integrity │
               └────────────────────────────────────────────────────────┘
```

---

## 2. Key Domain Rules & Database Source of Truth

- **Institution Hierarchy**: College &rarr; Department &rarr; Program &rarr; Batch &rarr; Section &rarr; Lab Group.
- **Computed Attendance & Eligibility**: Attendance % and eligibility status are computed on-the-fly via view `v_attendance_summary`. They are **never stored**. Default threshold is **75%** (configurable per college in `settings`).
- **Immutable Attendance via Locking**: Faculty mark attendance and click **Lock Lecture**. DB trigger `trg_lecture_session_guard` transitions the session to `held` and locks it. Once locked, trigger `trg_attendance_guard` strictly prevents any insert, update, or deletion.
- **Cancelled Lectures**: Excluded automatically from attendance calculations because `v_attendance_summary` only counts `held` lectures.
- **Internal Marks Matrix**: One row per component (`IT1`, `IT2`, `IT3`, `ASSIGNMENT`) with `UNIQUE(student_id, subject_assignment_id, component)`. Trigger `trg_marks_guard` enforces maximum component marks (`max_it_marks` and `max_assignment_marks`). A missing row denotes "not entered", distinct from 0.
- **Clash Prevention**: Room clashes and faculty clashes in the weekly timetable are prevented by PostgreSQL `UNIQUE` constraints and surfaced as clean HTTP 409 Conflict errors.
- **Soft Deactivation**: Users and records are deactivated (`is_active = false`), never hard-deleted.

---

## 3. Demo Credentials

All demo accounts share the password: **`Password@123`**

| Role | Email | Scope |
| :--- | :--- | :--- |
| **College Admin** | `admin@acadtrack.test` | Entire institution: setup, terms, threshold policy, analytics |
| **Dept Admin (HOD)** | `hod.co@acadtrack.test` | Computer Engineering: subjects, faculty allocations, timetable |
| **Faculty (DBMS & Elective)**| `faculty1@acadtrack.test` | Dr. Meera Kulkarni: today's lectures, take/lock attendance, marks |
| **Faculty (OS)** | `faculty2@acadtrack.test` | Prof. Anil Desai: Operating Systems lectures & marks |
| **Faculty (CN)** | `faculty3@acadtrack.test` | Prof. Neha Prabhu: Computer Networks lectures & marks |
| **Student** | `sahil@acadtrack.test` | Sahil Ghadi (Roll: 24B-CO-049): personal attendance %, eligibility & marks |
| **Student** | `pratham@acadtrack.test` | Pratham Honawarkar (Roll: 24B-CO-045): Section A & Elective |
| **Student** | `sanjeet@acadtrack.test` | Sanjeet Ghadi (Roll: 24B-CO-056): Section A |

---

## 4. Setup & Running Instructions (Windows / PowerShell)

### Prerequisites
- Node.js v18+ (tested on Node v20/v24)
- PostgreSQL 16+ running locally on port 5432

### Step 1: Database Setup
```powershell
# Create database (if not exists)
psql -U postgres -c "CREATE DATABASE acadtrack;"

# Load schema and seed data from project root
psql -U postgres -d acadtrack -f db/schema.sql
psql -U postgres -d acadtrack -f db/seed.sql
```

### Step 2: Backend Setup
```powershell
cd backend
# Verify .env exists (configured with your DB credentials)
# Start development server on port 5000:
npm run dev

# Run full automated test suite (71 tests covering all modules):
npm test # or: npx tsx tests/auth.test.ts; npx tsx tests/institution.test.ts; npx tsx tests/academic.test.ts; npx tsx tests/timetable.test.ts; npx tsx tests/attendance.test.ts; npx tsx tests/marks.test.ts; npx tsx tests/reports.test.ts
```

### Step 3: Frontend Setup
```powershell
cd ../frontend
# Start Next.js App Router on port 3000:
npm run dev
```

Open **`http://localhost:3000`** in your browser.

---

## 5. Automated Verification Suite (71 Tests)

The backend features 71 comprehensive automated tests across 7 test suites:

```text
=== Step 1: Auth Tests ===
  ✓ POST /login valid creds -> 200
  ✓ POST /login wrong password -> 401
  ✓ POST /login invalid body -> 400
  ✓ GET /me no token -> 401
  ✓ GET /me bad token -> 401
  ✓ GET /me valid token -> 200
  ✓ Faculty login and /me -> correct role
  ✓ Student login -> correct role
  (8/8 passed)

=== Step 2: Institution Tests ===
  ✓ GET /departments no token -> 401
  ✓ GET /departments student -> 403
  ✓ GET /departments faculty -> 403
  ✓ GET /departments admin -> 200
  ✓ GET /departments hod -> 200
  ✓ POST /departments hod -> 403
  ✓ POST /departments admin -> 201
  ✓ POST /departments duplicate -> 409
  ✓ GET /programs admin -> 200
  ✓ GET /batches admin -> 200
  ✓ GET /sections admin -> 200
  ✓ GET /lab-groups admin -> 200
  ✓ GET /academic-terms admin -> 200
  ✓ GET /academic-terms/current -> 200
  ✓ GET /settings admin -> 200
  ✓ PUT /settings admin -> 200
  ✓ GET /settings faculty -> 403
  (17/17 passed)

=== Step 3: Academic Tests ===
  ✓ GET /students no token -> 401
  ✓ GET /faculty student -> 403
  ✓ GET /students admin -> 200 with 6+ students
  ✓ GET /faculty admin -> 200 with 3+ faculty
  ✓ POST /students admin -> creates student with hashed password
  ✓ PATCH /users/:id/status (deactivate) -> login blocked
  ✓ PATCH /users/:id/status (reactivate) -> login allowed
  ✓ POST /subjects admin -> creates subject
  ✓ POST /electives on non-elective subject -> DB trigger rejects with 422
  ✓ POST /electives on real elective subject -> 201
  (10/10 passed)

=== Step 4: Timetable Tests ===
  ✓ GET /slots no token -> 401
  ✓ POST /slots student -> 403
  ✓ GET /slots admin -> 200 with 8 slots
  ✓ POST /slots room clash -> 409
  ✓ POST /slots faculty clash -> 409
  ✓ POST /slots non-clashing -> 201
  ✓ POST /sessions/generate -> 201
  ✓ PATCH /sessions/:id/cancel -> 200
  ✓ PATCH /sessions/:id/cancel on locked lecture -> trigger rejects with 409
  (9/9 passed)

=== Step 5: Attendance Tests ===
  ✓ GET /my-lectures no token -> 401
  ✓ GET /my-lectures student -> 403
  ✓ GET /sessions faculty -> 200 with scheduled open CO501 session
  ✓ GET /sessions/:id/students regular subject -> returns all 6 students
  ✓ GET /sessions/:id/students elective -> returns ONLY 2 enrolled students
  ✓ POST /sessions/:id/submit wrong faculty -> 403
  ✓ POST /sessions/:id/submit faculty valid -> 200
  ✓ POST /sessions/:id/lock faculty -> 200, locks session and marks held
  ✓ POST /sessions/:id/submit on LOCKED session -> DB trigger rejects with 409
  ✓ POST /sessions/:id/submit on CANCELLED lecture -> rejects with 422
  (10/10 passed)

=== Step 6: Marks Tests ===
  ✓ GET /assignments/:id no token -> 401
  ✓ POST /submit student -> 403
  ✓ GET /assignments/:id faculty -> 200 with student marks
  ✓ POST /submit wrong faculty -> 403
  ✓ POST /submit IT3 marks > 20 -> DB trigger rejects with 422
  ✓ POST /submit ASSIGNMENT marks > 10 -> DB trigger rejects with 422
  ✓ POST /submit valid bulk marks -> 200
  ✓ GET /assignments/:id -> IT3 marks are now populated
  (8/8 passed)

=== Step 7: Reports Tests ===
  ✓ GET /my-report no token -> 401
  ✓ GET /my-report student -> 200 with subjects, attendance % and marks
  ✓ GET /assignments/:id student -> 403 (students cannot see class lists)
  ✓ GET /analytics student -> 403 (students cannot see college analytics)
  ✓ GET /assignments/:id faculty -> 200 with full student attendance and marks
  ✓ GET /assignments/:id?below_threshold_only=true -> returns only ineligible students
  ✓ GET /assignments/:id/stats -> 200 with distribution and averages
  ✓ GET /analytics admin -> 200 with department-wise metrics
  ✓ GET /assignments/:id?format=csv -> 200 with text/csv content
  (9/9 passed)

Total: 71 / 71 passed (100% success rate)
```

---

## 6. Known Limitations

1. **Section-Level Timetable Clash Check**:
   Current clash prevention checks `(term_id, day_of_week, period_no, room)` and `(term_id, day_of_week, period_no, faculty_id)`. Section-level clash checks are left to academic scheduling policies because lab sessions split a single section across multiple concurrent lab groups (A1 in Lab 1, A2 in Lab 2).
2. **Row-Level Security (RLS)**:
   Scoping is enforced in application middleware and parameterized SQL queries. Native PostgreSQL Row-Level Security policies can be layered on top in production.
3. **Out of Scope by Design**:
   Grading, SGPA, and CGPA calculation are intentionally out of scope for AcadTrack, which focuses strictly on attendance, internal component marks, and exam eligibility thresholds.

---

## 7. Demo Script (Walking Through Each Role)

### Role 1: Student (`sahil@acadtrack.test`)
1. Open `http://localhost:3000/login` and click the **Student (Sahil)** quick-fill button. Click **Sign In**.
2. Automatically redirected to `/student`.
3. Notice personal student details (Roll: `24B-CO-049`, Computer Engineering, Section A, Lab A1).
4. View enrolled subjects: CO501 (DBMS), CO502 (OS), CO503 (CN), and CO5E1 (Cloud Computing Elective).
5. Notice the **Eligibility Badge**: green "Eligible" (&ge;75%) or red "Below 75%" with live percentage progress bar.
6. Observe the internal marks card displaying IT1, IT2, IT3, and Assignment marks side-by-side.

### Role 2: Faculty (`faculty1@acadtrack.test`)
1. Sign in as **Faculty (DBMS)**. Redirected to `/faculty`.
2. **Today's Lectures tab**: Select date `2026-10-05`.
3. Click the open lecture session for **CO501**.
4. Use **Mark All Present** or toggle individual student status buttons (Present/Absent).
5. Click **Lock Attendance**. Confirm the dialog warning.
6. Notice the session immediately transitions to **Locked & Held**. Editing is permanently disabled.
7. Switch to **Internal Marks Entry tab**:
   - Inspect students' existing marks.
   - Try entering `25` for IT1 (max is 20). Notice the inline validation and database rejection.
   - Enter valid IT3 marks (e.g. `18`) and click **Save All Marks**.
8. Switch to **Class Statistics & Reports tab**:
   - Review the attendance bracket distribution bar chart.
   - Click **Export CSV** to download `class_attendance_marks_report.csv`.

### Role 3: Dept Admin (`hod.co@acadtrack.test`)
1. Sign in as **Dept Admin (HOD)**. Redirected to `/dept-admin`.
2. View the **Weekly Timetable Grid** (Periods 1 to 6 across Monday to Saturday).
3. Click **Add Timetable Slot**:
   - Schedule a valid period, then try scheduling another lecture in the same room at the same time to observe the clash warning.
4. Switch to **Subjects Curriculum tab**: inspect theory vs. lab subjects and max marks.

### Role 4: College Admin (`admin@acadtrack.test`)
1. Sign in as **College Admin**. Redirected to `/college-admin`.
2. View **College Analytics**: comparative bar charts of average attendance and shortage students across departments.
3. Switch to **Threshold Settings tab**:
   - Update the attendance threshold from `75%` to `80%`.
   - Re-login as Student to see how the eligibility badges immediately update on the fly!

---

## 8. Viva Questions & Expert Answers

### Q1: Why are attendance percentage and exam eligibility computed via views rather than stored as table columns?
> **Answer**: Storing computed aggregates creates data redundancy and anomaly risks (if a past lecture is cancelled or an attendance row is corrected before locking, a stored percentage becomes stale unless synchronized via complex update hooks). In AcadTrack, `v_attendance_summary` uses `COUNT(*) FILTER (WHERE a.status = 'present')` joined against `lecture_session ls WHERE ls.status = 'held'`. This guarantees that attendance percentages and eligibility flags are mathematically accurate, automatically exclude cancelled lectures, and dynamically reflect changes to college threshold settings in `settings` without batch update jobs.

### Q2: How does AcadTrack guarantee that locked attendance cannot be altered, even by an admin or rogue SQL query?
> **Answer**: Immutability is enforced at the database layer via PostgreSQL triggers. When a faculty locks a lecture, trigger `trg_lecture_session_guard` sets `is_locked = true` and `status = 'held'`. Any subsequent UPDATE on `lecture_session` that attempts to unlock or change the session date/status raises an exception (`P0001`). Furthermore, trigger `trg_attendance_guard` intercepts all `INSERT`, `UPDATE`, or `DELETE` statements on table `attendance`: if `lecture_session.is_locked` is true, it raises `'Attendance for lecture % is locked and cannot be changed'`. Because triggers run inside the transaction, the modification is rolled back at the database level regardless of API code.

### Q3: Why did you choose PostgreSQL over MySQL for AcadTrack?
> **Answer**: AcadTrack is a rule-heavy, relational academic system. PostgreSQL was chosen for:
> 1. **`COUNT(*) FILTER (WHERE ...)` syntax**: Enables clean, declarative conditional aggregation in summary views without awkward `SUM(CASE ...)` hacks.
> 2. **Transactional DDL**: Schema migrations and multi-table setup scripts run inside an atomic `BEGIN ... COMMIT` block.
> 3. **Partial Unique Indexes**: Used for `uq_one_current_term` (`CREATE UNIQUE INDEX ON academic_term (college_id) WHERE is_current`), ensuring at most one active academic term per college directly in the index engine.
> 4. **Built-in Trigger Diagnostics & Exception Handling**: `RAISE EXCEPTION` in PL/pgSQL maps directly to standard SQLSTATE `P0001`, which our central Express error handler intercepts and formats into user-friendly HTTP 409/422 responses.

### Q4: How is data scoped between roles (College Admin, Dept Admin, Faculty, Student)?
> **Answer**: AcadTrack enforces defense-in-depth scoping in both Express middleware and parameterized SQL queries:
> - **Authentication**: JWT payload contains `{ id, role, collegeId, departmentId }`.
> - **Students**: The route `/api/reports/my-report` extracts `req.user.id` from the verified token and queries only `student WHERE user_id = $1`. Students have no access to class-level queries (403 Forbidden).
> - **Faculty**: Can only fetch their own assigned lectures (`WHERE f.user_id = $1`) and cannot take attendance or enter marks for subjects assigned to other teachers (`403 Forbidden`).
> - **Department Admin**: Scoped to `department_id = req.user.departmentId` for programs, subjects, and timetables.
> - **College Admin**: Filtered to `college_id = req.user.collegeId` to ensure total tenant isolation.

### Q5: How does the internal marks model handle pending marks vs. zero marks?
> **Answer**: In AcadTrack, marks are normalized as one row per component (`IT1`, `IT2`, `IT3`, `ASSIGNMENT`) with a surrogate key and a unique constraint `UNIQUE(student_id, subject_assignment_id, component)`. A missing row in the `marks` table represents **"not yet entered / pending"** (rendered as `null` or a placeholder in the UI). When a student scores zero, a row exists with `marks_obtained = 0.00`. In a flat four-column table (`it1, it2, it3, assignment`), distinguishing between an unentered test and a score of 0 requires nullable columns with ambiguous semantics, and adding new evaluation components would require DDL schema alterations. Our normalized design allows flexible component evaluation and clean trigger-based max-mark validation.
