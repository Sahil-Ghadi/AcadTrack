# AcadTrack: Project Context and Handoff

> Paste this whole file at the start of a new chat with any LLM, then say: "Read the context, confirm you understand the current status, and guide me through the next step."
> Written 12 Oct 2026. Source of truth for the database is Appendix A (`schema.sql`). Everything below the "Current status" section describes what actually exists today.

---

## 0. How the assistant should work with me (IMPORTANT)

- I am a student on a 3-person team building this as a DBMS mini project. I want to **write the code myself**.
- **Guide me one step at a time**: say what to create, where (exact path), what it must do, what "done" looks like, and how to test it. Wait for me to report back before the next step.
- **Do not dump code unless I ask** ("give code", "give the file"). When I ask for code, give complete, copy-pasteable files, and say what changed and why.
- Give **official documentation links** for each step. If you are not sure a link is current, say so.
- Be honest about uncertainty. If a library version or behaviour may have changed, say so instead of guessing. I have already hit one such case (TypeScript 7 vs ts-node-dev, see section 8).
- When I paste an error, explain the cause and point to the exact line before suggesting a fix.
- Do not claim things MySQL "cannot do" unless certain. I was previously corrected on this (see section 3).
- My OS is **Windows**, editor is **VS Code**, shell is PowerShell/cmd. API testing tool: **Thunder Client** (VS Code extension).

---

## 1. What AcadTrack is

A relational, role-based web system for **lecture attendance, internal marks and eligibility tracking** in colleges. It replaces fragmented spreadsheets, editable attendance, and late eligibility checks.

Key ideas from the requirement analysis PDF:
- Multi-college structure: College → Department → Program → Batch → Section → Lab Group.
- Faculty take attendance **at lecture time** and then **lock** it; locked attendance is immutable.
- Internal marks per subject: **IT1, IT2, IT3 and Assignment**, entered by faculty with max-mark validation.
- **Attendance % and eligibility are computed by SQL** (never stored). Default threshold **75%** (configurable per college in `settings`).
- Cancelled lectures are excluded from attendance %.
- Records are **deactivated, never deleted** (`is_active`).
- Role-scoped access: students see only their own data, faculty only their classes, dept admins their department, college admins the whole college.
- **Out of scope:** grading, SGPA, CGPA.
- Internet connection required; PostgreSQL is a stated constraint.

### Roles
| Role | Scope |
|---|---|
| `college_admin` | Whole college: institution setup, terms, settings, analytics across departments |
| `dept_admin` | Their department: subjects, assignments, timetable, department reports |
| `faculty` | Their assigned subjects/sections: take and lock attendance, enter marks, class statistics |
| `student` | Read-only view of their own attendance %, eligibility, marks |

### Team
Sahil Ghadi (24B-CO-049), Pratham Honawarkar (24B-CO-045), Sanjeet Ghadi (24B-CO-056). The user talking to you is Sahil.

### Major modules (from the PDF)
1. User/Access Management 2. Institution Setup 3. Subject/Assignment 4. Timetable 5. Attendance 6. Marks 7. Analytics/Reports

### Business rules (known)
- Locked attendance can never be modified.
- Attendance threshold is 75% by default (from `settings`).
- Cancelled lectures are excluded from attendance calculations.
- Marks cannot exceed the subject's maximum for that component.
- Users/records are deactivated, never deleted.
- Faculty/room clashes in the timetable must be prevented.
- (The PDF lists 10 rules and FR1-FR15 / UC01-UC16; only the ones above were carried into the design.)

---

## 2. Tech stack (decided)

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router, TypeScript) + Tailwind CSS (scaffolded, **nothing built yet**) |
| Backend | Node.js + Express **5.x** + TypeScript, CommonJS output |
| Database | PostgreSQL (16+ works; user installed a recent version on Windows) |
| Auth | JWT (`jsonwebtoken`) + `bcrypt` password hashes |
| Validation | Zod |
| Tools | VS Code, Git/GitHub, Thunder Client, pgAdmin / psql |

---

## 3. Why PostgreSQL (for viva answers)

Accurate points only:
- Relational, rule-heavy, report-heavy data; attendance % via SQL aggregates.
- **Row-Level Security** (MySQL has no built-in equivalent) for role-scoped access. *Not implemented yet; backend scoping is used first.*
- **Transactional DDL** (safer multi-step migrations).
- **Exclusion constraints, partial unique indexes, deferrable constraints** (MySQL lacks these or only emulates them).
- `COUNT(*) FILTER (WHERE ...)` is cleaner than `SUM(CASE ...)` (convenience, not capability).
- Mature JSONB and range/array types.

**Do NOT claim** MySQL lacks triggers, CHECK constraints (since 8.0.16), ENUM, JSON, ACID transactions, joins, CTEs, or window functions (MySQL 8 has them). Viva line: "AcadTrack is relational and rule-heavy; PostgreSQL gives stronger constraint and security features so rules like locked attendance and clash prevention are enforced by the database itself. MySQL could also work, with more workarounds in app code."

---

## 4. Data model summary

Full SQL is in **Appendix A**. 18 tables:

- **Institution:** `college`, `department`, `program`, `batch`, `section`, `lab_group`, `academic_term`, `settings`
- **People:** `app_user` (role column; `user` is reserved in PostgreSQL, hence the name), `student`, `faculty`
- **Teaching:** `subject`, `subject_assignment` (junction: subject + faculty + section + optional lab_group + term), `elective_enrollment`
- **Schedule/records:** `timetable_slot`, `lecture_session`, `attendance`, `marks`

Relationships (cardinality): College 1:N Department, AcademicTerm, AppUser; College 1:1 Settings; Department 1:N Program, Subject, Faculty; Program 1:N Batch; Batch 1:N Section; Section 1:N LabGroup, Student; AppUser 1:1 Student/Faculty; Student M:N Subject via `elective_enrollment`; `subject_assignment` links Faculty+Subject+Section+Term; SubjectAssignment 1:N TimetableSlot; TimetableSlot 1:N LectureSession; LectureSession M:N Student via `attendance`; Student M:N SubjectAssignment via `marks`.

### Design decisions
- **Locking is on `lecture_session`** (`is_locked`), not per attendance row. One flag locks the whole lecture.
- **Marks are one row per component** (`component` = IT1/IT2/IT3/ASSIGNMENT), not four columns. A missing row means "not entered yet", which differs from 0.
- **Attendance %, eligibility and marks pivots are views**, never stored.
- `attendance` and `marks` have surrogate `id` plus a UNIQUE key; conceptually they are associative entities (junctions). In Chen notation they were drawn as relationships with attributes (attendance = "attends", marks = "scored in", elective = "opts").
- Clash prevention uses UNIQUE constraints on `timetable_slot` `(term_id, day_of_week, period_no, room)` and `(term_id, day_of_week, period_no, faculty_id)`. `faculty_id` and `term_id` are copied from `subject_assignment` by a trigger.
- Composite FK `(lab_group_id, section_id)` proves a lab group belongs to the section.

### Triggers (in schema.sql)
| Trigger | Rule |
|---|---|
| `slot_fill` | copies `faculty_id`, `term_id` into `timetable_slot` from its assignment |
| `elective_guard` | only subjects with `is_elective = true` can be enrolled |
| `lecture_session_guard` | locking is one-way; locking sets status `held` and `locked_at`; cancelled lectures cannot be locked; locked rows cannot change status/date/slot |
| `attendance_guard` | no insert/update/delete once the lecture is locked; none for cancelled lectures |
| `marks_guard` | marks cannot exceed `max_it_marks` / `max_assignment_marks`; sets `updated_at` |

### Views
- `v_attendance_summary` (student_id, subject_assignment_id, subject_id, total_lectures, present_count, attendance_pct, attendance_threshold, is_eligible), counting only `held` lectures.
- `v_marks_summary` (student_id, subject_assignment_id, it1, it2, it3, assignment).

### Known gaps / possible later work
- No **section-level** timetable clash check (a section could be double-booked); lab-group splits make it non-trivial.
- **Row-Level Security** not implemented (role scoping must be done in backend middleware and queries).
- `app_user` to `department` link (for dept admins) exists in SQL but was omitted from the Chen diagram for readability. `lab_group` to `subject_assignment` also omitted from the diagram.
- Attendance rows are expected to exist for every enrolled student when a lecture is marked (the view counts only existing rows).

### Seed data (`seed.sql`, all illustrative)
- 1 college "Demo College of Engineering" (DCE), threshold 75, dept CO, B.E. Computer Engineering, batch 2024-2028, sections A and B, lab groups A1/A2 under A, current term 2026-2027 odd (20 Jul - 30 Nov 2026).
- 11 users, **all with password `Password@123`**:
  - `admin@acadtrack.test` (college_admin), `hod.co@acadtrack.test` (dept_admin)
  - `faculty1@acadtrack.test`, `faculty2@...`, `faculty3@...` (faculty: Dr. Meera Kulkarni EMP101, Prof. Anil Desai EMP102, Prof. Neha Prabhu EMP103)
  - students: `sahil@`, `pratham@`, `sanjeet@`, `aarav@`, `diya@`, `rohan@` `acadtrack.test` (all in section A)
- Subjects (semester 5): CO501 DBMS, CO502 OS, CO503 CN, CO5E1 Cloud Computing (elective; Sahil and Pratham enrolled). Faculty1 teaches DBMS and the elective.
- Weekly timetable (room R204; elective R305 Friday), lecture sessions 3 Aug - 31 Oct 2026, one cancelled, past lectures locked/held, October ones still open, attendance generated with a deterministic pattern, marks for IT1/IT2/ASSIGNMENT (IT3 pending).
- The SQL was tested on PostgreSQL 16 in a sandbox (loads cleanly; views and triggers work).

---

## 5. Deliverables already produced (by the assistant, earlier)

1. **An 18-slide PowerPoint** (`AcadTrack_Presentation.pptx`) built from the requirement PDF, including 8 UI mockup slides: login/role access, faculty today's lectures, take-and-lock attendance, marks entry with validation error, class statistics with charts, student own record, dept-admin timetable with clash warning, college analytics with charts. Use these as the UI spec for the frontend.
2. **ER diagrams:** Mermaid crow's-foot (`AcadTrack_ER_Diagram.mermaid`), and Chen notation as two pages plus one combined page (SVG/PNG).
3. **Database files** `schema.sql` and `seed.sql` (in `db/`).

---

## 6. Current status (as of 12 Oct 2026)

**DONE and tested**
- Repo folders: `backend/`, `db/`, `frontend/` (frontend = untouched `create-next-app`).
- Database `acadtrack` created in local PostgreSQL; `db/schema.sql` and `db/seed.sql` loaded (the user had to be re-given these files once; confirm with `SELECT name FROM college;`).
- Backend skeleton, `/health`, DB pool, **`POST /api/auth/login`** working. Tested in Thunder Client: 200 with token for correct credentials, 401 for wrong password, 400 for invalid body.

**NOT done yet**
- Auth middleware (verify JWT, `req.user`, role check), central error handler.
- Every module: institution setup, subjects/assignments, timetable and sessions, attendance, marks, reports.
- The whole frontend.
- First Git commit may not have been made yet (remind the user: check `.env` and `node_modules` are ignored first).

**Immediate next step: Step 7, auth middleware** (see section 10).

---

## 7. Backend structure and conventions

```
backend/
├── .env                 (never commit)   .env.example (commit)   .gitignore (node_modules, .env, dist)
├── package.json  tsconfig.json
└── src/
    ├── app.ts           Express app: cors, express.json, /health, mounts routers
    ├── server.ts        `import "dotenv/config"` FIRST, then listens on PORT
    ├── config/db.ts     one shared pg Pool (default export)
    ├── routes/          URL -> controller mapping only
    ├── controllers/     parse/validate request, call service, send response + status code
    ├── services/        business logic + SQL (parameterized)
    ├── validators/      Zod schemas
    ├── middleware/      authenticate, authorize(...roles), error handler
    ├── types/           express.d.ts (req.user typing), shared types
    └── utils/           helpers
```
Flow per request: route -> (authenticate -> authorize) -> controller (validate with Zod) -> service (SQL) -> response.

Rules: parameterized queries only (`$1, $2`); transactions for multi-step writes (e.g. locking, bulk marks); scope data by role **in both middleware and SQL**; never return `password_hash`; let DB triggers reject rule violations and translate the error; same message for unknown email and wrong password.

Suggested Postgres-error mapping for the central error handler: `23505` unique violation -> 409; `23503` FK violation -> 409/400; `23514` check violation -> 400; `P0001` (RAISE EXCEPTION from our triggers, e.g. "locked", "exceed the maximum") -> 409 or 422 with the trigger's message; anything else -> 500 with a generic message.

### `.env` keys (values not shown)
`PORT=5000`, `NODE_ENV`, `DB_HOST`, `DB_PORT=5432`, `DB_USER=postgres`, `DB_PASSWORD`, `DB_NAME=acadtrack`, `JWT_SECRET`, `JWT_EXPIRES_IN` (service default `7d`). Frontend dev server uses port 3000, so the API must not.

---

## 8. Environment facts and gotchas already hit

- **TypeScript is v7.0.2.** `ts-node-dev` depends on `ts-node`, which relies on APIs removed in TS 7, so the dev runner is **`tsx`** (`tsx watch src/server.ts`). `tsx` does not type-check, so run `npx tsc --noEmit` regularly.
- **Express 5** (not 4): async handler errors reach the error handler automatically; some older tutorials differ. Migration guide: https://expressjs.com/en/guide/migrating-5.html
- `tsconfig.json`: `module: nodenext`, `target: esnext`, `types: ["node"]`, `strict`, `esModuleInterop`, `isolatedModules`, `skipLibCheck`, `rootDir ./src`, `outDir ./dist`, `include: ["src"]`. React/extra-strict options were removed deliberately.
- `package.json` is `"type": "commonjs"`. Scripts: `dev` = `tsx watch src/server.ts`, `build` = `tsc`, `start` = `node dist/server.js`.
- Installed: runtime `bcrypt`, `cors`, `dotenv` (v18), `express`, `jsonwebtoken`, `pg`, **`zod`**; dev `typescript`, `tsx`, `@types/{bcrypt,cors,express,jsonwebtoken,node,pg}`.
- `JWT_SECRET` narrowing: TypeScript does not carry a top-level `if (!x) throw` narrowing into hoisted functions. Pattern used: `const secret = process.env.JWT_SECRET; if (!secret) throw ...; const JWT_SECRET: string = secret;`
- Past typo bugs to avoid: SQL `from` (not `for`), column `is_active` (not `isactive`).
- `psql` was not on PATH initially; user installed PostgreSQL and added `C:\Program Files\PostgreSQL\<ver>\bin` to PATH. pgAdmin's Query Tool is a fallback for running SQL files.
- `frontend/` contains `AGENTS.md` and `CLAUDE.md` generated by `create-next-app`; harmless notes for AI tools.

---

## 9. Existing backend code (reference versions)

> The user's actual files may differ slightly. Ask to see a file before editing it.

**src/app.ts**
```ts
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "acadtrack-api", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);

export default app;
```
(CORS is wide open for development; restrict to `http://localhost:3000` later. A temporary `/db-test` route may or may not have been removed.)

**src/server.ts**
```ts
import "dotenv/config";
import app from "./app";

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`AcadTrack API running on http://localhost:${PORT}`);
});
```

**src/config/db.ts**
```ts
import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.on("error", (err) => {
  console.error("Unexpected database error:", err);
});

export default pool;
```

**src/validators/auth.validator.ts**
```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});
```

**src/services/auth.service.ts** (final corrected form)
```ts
import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import pool from "../config/db";

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET not defined");
}
const JWT_SECRET: string = secret;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

export async function login(email: string, password: string) {
  const { rows } = await pool.query(
    `select id, college_id, department_id, email, password_hash, role
       from app_user
      where email = $1 and is_active = true`,
    [email.toLowerCase()]
  );

  const user = rows[0];
  if (!user) return null;

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) return null;

  const token = jwt.sign(
    { id: user.id, role: user.role, collegeId: user.college_id, departmentId: user.department_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    token,
    user: { id: user.id, email: user.email, role: user.role, collegeId: user.college_id, departmentId: user.department_id },
  };
}
```

**src/controllers/auth.controller.ts**
```ts
import type { Request, Response } from "express";
import { loginSchema } from "../validators/auth.validator";
import * as authService from "../services/auth.service";

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid input",
      errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }

  const result = await authService.login(parsed.data.email, parsed.data.password);
  if (!result) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  return res.json(result);
}
```

**src/routes/auth.routes.ts**
```ts
import { Router } from "express";
import { login } from "../controllers/auth.controller";

const router = Router();
router.post("/login", login);
export default router;
```

JWT payload shape: `{ id, role, collegeId, departmentId }`. Login response: `{ token, user: { id, email, role, collegeId, departmentId } }`.

---

## 10. Roadmap (do in this order, one step at a time)

**Step 7: Auth middleware** (next)
1. `src/types/express.d.ts`: extend `Express.Request` with `user?: { id: number; role: 'college_admin'|'dept_admin'|'faculty'|'student'; collegeId: number; departmentId: number | null }`.
2. `src/middleware/auth.middleware.ts` `authenticate`: read `Authorization: Bearer <token>`, `jwt.verify`, attach `req.user`, 401 on missing/invalid/expired.
3. `src/middleware/role.middleware.ts` `authorize(...roles)`: 403 if role not allowed. Always put `authenticate` first.
4. Test routes: `GET /api/auth/me` (authenticate only) and a throwaway admin-only route. Expected: no token 401, bad token 401, valid 200, faculty on admin route 403, admin 200.

**Step 8:** central error handler (map Postgres/Zod errors, section 7), then a small `asyncHandler`-free style thanks to Express 5.

**Step 9+: modules** (each = route + controller + service + validator, tested in Thunder Client per role)
1. Institution setup: departments, programs, batches, sections, lab groups, academic terms, settings (college_admin; dept_admin limited to own department).
2. Subjects and subject assignments; elective enrollment.
3. Timetable slots (clash errors come from UNIQUE constraints) and lecture-session generation for a date range; cancel a lecture.
4. Attendance: faculty lists today's lectures -> get student list for a session -> submit attendance in one transaction -> lock (DB trigger then forbids edits). Faculty may only act on their own assignments.
5. Marks: faculty enters IT1/IT2/IT3/ASSIGNMENT per student (upsert on the UNIQUE key); max-mark trigger errors surfaced cleanly.
6. Reports: attendance % and eligibility from `v_attendance_summary`, marks from `v_marks_summary`, class statistics, below-threshold lists, department/college analytics, CSV export. Students only see their own rows.
7. Optional hardening: Row-Level Security policies, CORS restriction, rate limiting on login, refresh/expiry handling.

**Frontend** (after the matching API exists): login page, role-based redirects, then the 8 mockup screens listed in section 5. Next.js docs: https://nextjs.org/docs ; Tailwind: https://tailwindcss.com/docs

**Collaboration idea (3 people):** one owns DB + auth/attendance backend, one owns setup/timetable/marks APIs, one owns frontend + analytics. Git branch per feature, PRs into `main`.

---

## 11. Handy commands

```bash
# run API (inside backend/)
npm run dev
npx tsc --noEmit

# load database (from project root; run schema first)
psql -U postgres -d acadtrack -f db/schema.sql
psql -U postgres -d acadtrack -f db/seed.sql
psql -U postgres -d acadtrack -c "SELECT email, role FROM app_user;"
```
Login test (Thunder Client): `POST http://localhost:5000/api/auth/login`, JSON body `{ "email": "faculty1@acadtrack.test", "password": "Password@123" }`.
Re-running `schema.sql` **wipes all data** (development only); run `seed.sql` afterwards.

Documentation links: Express https://expressjs.com/ | node-postgres https://node-postgres.com/ | jsonwebtoken https://github.com/auth0/node-jsonwebtoken | bcrypt https://github.com/kelektiv/node.bcrypt.js | Zod https://zod.dev | TypeScript tsconfig https://www.typescriptlang.org/tsconfig | tsx https://tsx.is | PostgreSQL https://www.postgresql.org/docs/current/

---

## Appendix A: `db/schema.sql` (source of truth)

```sql
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
```

---
*End of context. Appendix B (seed data) is summarised in section 4; the full `seed.sql` is in the repo `db/` folder.*
