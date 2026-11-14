# How to Run AcadTrack (Step-by-Step Guide for Sahil)

This guide provides the easiest ways to launch and use **AcadTrack** on your computer.

---

## ⚡ Option 1: One-Click Quick Launch (Recommended)

In your project folder (`AcadTrack`), you now have launcher scripts:

### Method A: Double-Click Batch File
1. Open Windows File Explorer and navigate to:  
   `C:\Users\Sahil Ghadi\Desktop\Projects\AcadTrack`
2. **Double-click `start-dev.bat`**.
3. It will:
   - Open a window running the **Backend API** (`http://localhost:5000`)
   - Open a window running the **Next.js Frontend** (`http://localhost:3000`)
   - Automatically open **`http://localhost:3000`** in your default web browser!

---

### Method B: Single PowerShell Command
From a PowerShell terminal in the project root:
```powershell
.\start-dev.ps1
```

---

## 🖥️ Option 2: Running Manually Inside VS Code

If you prefer to run both servers inside VS Code using terminal tabs:

### Terminal 1 — Backend (Port 5000)
1. Open VS Code Terminal (`Ctrl + ~` or `Ctrl + Shift + \``).
2. Run:
   ```powershell
   cd backend
   npm run dev
   ```
3. You should see:
   ```text
   Acadtrack api running on http://localhost:5000
   ```

### Terminal 2 — Frontend (Port 3000)
1. Click the **`+`** icon in the top right of your VS Code terminal panel to split or open a second terminal.
2. Run:
   ```powershell
   cd frontend
   npm run dev
   ```
3. You should see:
   ```text
   ▲ Next.js 16.3.8 (Turbopack)
   - Local: http://localhost:3000
   ✓ Ready in ...
   ```

---

## 🌐 Opening the Application

Open your browser and navigate to:  
👉 **[http://localhost:3000](http://localhost:3000)**

*(If you are not logged in, you will automatically be redirected to `/login`)*.

---

## 👤 What to Do in the App (Test Each Role)

All demo accounts share the password: **`Password@123`**  
On the login page, you can click the colored quick-fill buttons to autofill any role in 1 click!

### 1. Test as Student (Your Account: Sahil Ghadi)
1. Click the **Student (Sahil)** pill button on the login screen.
2. Click **Sign In**.
3. **What to check:**
   - Your name **Sahil Ghadi**, Roll Number **24B-CO-049**, Section A, Lab Group A1.
   - Enrolled subjects: **CO501 (DBMS)**, **CO502 (OS)**, **CO503 (CN)**, and **CO5E1 (Cloud Computing Elective)**.
   - Live attendance percentage progress bars.
   - Dynamic **Eligible** (&ge;75%) vs **Attendance Shortage** badge.
   - Component marks breakdown: **IT1, IT2, IT3, Assignment**.

---

### 2. Test as Faculty (Dr. Meera Kulkarni)
1. Click **Logout** at the top right.
2. Click the **Faculty (DBMS)** pill button (`faculty1@acadtrack.test`) and sign in.
3. **What to test:**
   - **Today's Lectures tab**: Select date `2026-10-05`.
   - Click the scheduled **CO501** lecture session.
   - Try clicking **Mark All Present**, **Mark All Absent**, or toggle individual students.
   - Click **Lock Attendance** and confirm the dialog. Notice how the lecture locks permanently and marks status as `held`.
   - **Internal Marks Entry tab**:
     - View student marks.
     - Try typing `25` for IT1 (max is 20) &rarr; notice the inline warning.
     - Enter valid marks and click **Save All Marks**.
   - **Class Statistics & Reports tab**:
     - View the interactive bar chart showing attendance distribution brackets.
     - Click **Export CSV** to download the spreadsheet report.

---

### 3. Test as Dept Admin (HOD Computer Engineering)
1. Logout and sign in as **Dept Admin (HOD)** (`hod.co@acadtrack.test`).
2. **What to test:**
   - **Timetable Grid tab**: View the weekly schedule (Monday to Saturday, Periods 1 to 6).
   - Click **Add Timetable Slot**: Try scheduling two classes at the same room/time to see the automatic **Timetable Clash Warning (409)**.
   - **Subjects Curriculum tab**: View theory vs lab subjects and max marks.
   - **Faculty Assignments tab**: View which faculty teach which sections.

---

### 4. Test as College Admin
1. Logout and sign in as **College Admin** (`admin@acadtrack.test`).
2. **What to test:**
   - **College Analytics tab**: View bar chart comparing student attendance and eligibility across departments.
   - **Hierarchy & Structure tab**: View Departments, Degree Programs, Batches, and Sections.
   - **Academic Terms tab**: View terms and switch the current active term.
   - **Threshold Settings tab**:
     - Change the attendance eligibility threshold (e.g., from `75%` to `80%`).
     - Click **Save Policy**.
     - Sign back in as a student to see how the eligibility badges instantly recalculate!

---

## 🛑 How to Stop the App

- **If using `start-dev.bat` or `start-dev.ps1`**: Simply close the two opened command prompt / PowerShell terminal windows.
- **If using VS Code terminals**: Click inside each terminal tab and press `Ctrl + C`, then press `Y` to terminate.
