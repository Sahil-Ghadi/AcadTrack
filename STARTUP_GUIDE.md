# AcadTrack — Quick Startup Guide

This guide walks you through setting up and running **AcadTrack** from scratch on Windows using PowerShell.

---

## 📋 Prerequisites

Before starting, ensure you have installed:
1. **Node.js** (v18 or higher) — [Download Node.js](https://nodejs.org/)
2. **PostgreSQL** (v14 or higher, tested on v16) — [Download PostgreSQL](https://www.postgresql.org/download/windows/)
3. **PowerShell** or any terminal of your choice

---

## 🚀 Step 1: Database Setup

1. Open PowerShell and verify PostgreSQL's `psql` command is available:
   ```powershell
   psql --version
   ```
   *(If `psql` is not recognized, add `C:\Program Files\PostgreSQL\<version>\bin` to your System PATH).*

2. Create the `acadtrack` database (enter your postgres superuser password when prompted):
   ```powershell
   psql -U postgres -c "CREATE DATABASE acadtrack;"
   ```

3. From the project root (`c:\Users\Sahil Ghadi\Desktop\Projects\AcadTrack`), load the schema and seed data:
   ```powershell
   # Load tables, triggers, and views
   psql -U postgres -d acadtrack -f db/schema.sql

   # Load demo users, subjects, timetable, and initial records
   psql -U postgres -d acadtrack -f db/seed.sql
   ```

4. Verify database setup by querying demo users:
   ```powershell
   psql -U postgres -d acadtrack -c "SELECT email, role FROM app_user;"
   ```

---

## ⚙️ Step 2: Backend API Setup

1. Navigate to the `backend/` directory:
   ```powershell
   cd backend
   ```

2. Confirm your `backend/.env` file has the correct database password:
   ```env
   PORT=5000
   NODE_ENV=development
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   DB_NAME=acadtrack
   JWT_SECRET=84730e1d2a6c8186b60ba825ff98349ae9eb81c6b0e633b921a412f265f6c942
   JWT_EXPIRES_IN=7d
   ```

3. Start the Express API development server:
   ```powershell
   npm run dev
   ```
   *The API will start at **http://localhost:5000**.*

4. *(Optional)* In a separate terminal, run the 71-test regression suite to verify all backend modules:
   ```powershell
   cd backend
   npx tsx tests/auth.test.ts; npx tsx tests/institution.test.ts; npx tsx tests/academic.test.ts; npx tsx tests/timetable.test.ts; npx tsx tests/attendance.test.ts; npx tsx tests/marks.test.ts; npx tsx tests/reports.test.ts
   ```

---

## 💻 Step 3: Frontend Next.js Setup

1. Open a new PowerShell terminal and navigate to the `frontend/` directory:
   ```powershell
   cd frontend
   ```

2. Ensure `frontend/.env.local` contains:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000
   ```

3. Start the Next.js development server:
   ```powershell
   npm run dev -- -p 3000
   ```
   *The web application is now running at **http://localhost:3000**.*

---

## 🔑 Step 4: Login with Demo Accounts

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

All accounts use the password: **`Password@123`**  
*(You can also use the 1-click quick-fill buttons on the login screen!)*

| Role | Email | Features to Explore |
| :--- | :--- | :--- |
| **College Admin** | `admin@acadtrack.test` | Overall college analytics charts, attendance threshold policy (e.g. 75% &rarr; 80%), department and academic term management |
| **Dept Admin (HOD)** | `hod.co@acadtrack.test` | Weekly timetable grid (clash detection), curriculum subjects, assigning faculty to sections |
| **Faculty (DBMS)** | `faculty1@acadtrack.test` | View scheduled lectures, take & **lock** attendance, internal marks entry (IT1/IT2/IT3/Assignment) with max-marks validation, class performance graphs & CSV export |
| **Student (Sahil)** | `sahil@acadtrack.test` | Personal dashboard: enrolled subjects, attendance percentage with progress bar, dynamic exam **Eligible / Shortage** badge, and component marks |

---

## 🛠️ Common Troubleshooting

### 1. Port 5000 or 3000 Already in Use
If a port is occupied by a previous process, find and terminate it:
```powershell
# Check what is using port 5000
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force

# Check what is using port 3000
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
```

### 2. Reset Database to Seed State
If you want to wipe test modifications and restore the clean initial seed data:
```powershell
# From project root:
psql -U postgres -d acadtrack -f db/schema.sql
psql -U postgres -d acadtrack -f db/seed.sql
```

### 3. PostgreSQL Authentication Error
Ensure your postgres password in `backend/.env` matches the password you set during PostgreSQL installation. Test connectivity directly:
```powershell
psql -U postgres -d acadtrack -c "SELECT current_database();"
```

---

## 📦 Production Build Checks

To verify production builds for both projects:
```powershell
# Backend
cd backend
npm run build

# Frontend
cd ../frontend
npm run build
```
