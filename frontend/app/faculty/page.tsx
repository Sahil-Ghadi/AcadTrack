"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { apiFetch } from "@/lib/api";
import {
  Calendar,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  AlertTriangle,
  Download,
  Users,
  Award,
  BarChart3,
  Loader2,
  Check,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function FacultyDashboard() {
  const [activeTab, setActiveTab] = useState<"lectures" | "marks" | "stats">("lectures");

  // --- Tab 1: Lectures & Attendance State ---
  const [selectedDate, setSelectedDate] = useState("2026-10-05");
  const [lectures, setLectures] = useState<any[]>([]);
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [sessionStudents, setSessionStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [attendanceMap, setAttendanceMap] = useState<Record<number, "present" | "absent">>({});
  const [submittingAttendance, setSubmittingAttendance] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // --- Tab 2: Marks Entry State ---
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignId, setSelectedAssignId] = useState<number | null>(null);
  const [marksStudents, setMarksStudents] = useState<any[]>([]);
  const [marksData, setMarksData] = useState<
    Record<number, { it1: string; it2: string; it3: string; assignment: string }>
  >({});
  const [currentAssignMeta, setCurrentAssignMeta] = useState<any | null>(null);
  const [savingMarks, setSavingMarks] = useState(false);

  // --- Tab 3: Statistics State ---
  const [statsAssignId, setStatsAssignId] = useState<number | null>(null);
  const [statsData, setStatsData] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    loadFacultyAssignments();
  }, []);

  useEffect(() => {
    if (activeTab === "lectures") {
      loadLectures();
    }
  }, [selectedDate, activeTab]);

  useEffect(() => {
    if (selectedAssignId) {
      loadMarksForAssignment(selectedAssignId);
    }
  }, [selectedAssignId]);

  useEffect(() => {
    if (statsAssignId) {
      loadStatsForAssignment(statsAssignId);
    }
  }, [statsAssignId]);

  // Load faculty's assigned subjects
  async function loadFacultyAssignments() {
    try {
      const res = await apiFetch<any[]>("/api/academic/assignments");
      setAssignments(res);
      if (res.length > 0) {
        setSelectedAssignId(res[0].id);
        setStatsAssignId(res[0].id);
      }
    } catch {}
  }

  // Load lectures for selected date
  async function loadLectures() {
    setLoadingLectures(true);
    try {
      const res = await apiFetch<any[]>(`/api/attendance/my-lectures?date=${selectedDate}`);
      setLectures(res);
      if (res.length > 0) {
        selectSession(res[0]);
      } else {
        setSelectedSession(null);
        setSessionStudents([]);
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to load lectures");
    } finally {
      setLoadingLectures(false);
    }
  }

  // Select a session to view/take attendance
  async function selectSession(session: any) {
    setSelectedSession(session);
    setLoadingStudents(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const res = await apiFetch<any>(`/api/attendance/sessions/${session.id}/students`);
      setSessionStudents(res.students);
      // Initialize attendance map
      const map: Record<number, "present" | "absent"> = {};
      res.students.forEach((s: any) => {
        map[s.id] = s.attendance_status || "present";
      });
      setAttendanceMap(map);
    } catch (err: any) {
      setActionError(err.message || "Failed to load session students");
    } finally {
      setLoadingStudents(false);
    }
  }

  function toggleStudent(studentId: number) {
    if (selectedSession?.is_locked) return;
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === "present" ? "absent" : "present",
    }));
  }

  function setAllAttendance(status: "present" | "absent") {
    if (selectedSession?.is_locked) return;
    const map: Record<number, "present" | "absent"> = {};
    sessionStudents.forEach((s) => {
      map[s.id] = status;
    });
    setAttendanceMap(map);
  }

  async function submitAttendance(lock: boolean) {
    if (!selectedSession) return;
    setSubmittingAttendance(true);
    setActionSuccess(null);
    setActionError(null);

    const records = sessionStudents.map((s) => ({
      student_id: s.id,
      status: attendanceMap[s.id] || "present",
    }));

    try {
      const res = await apiFetch<any>(`/api/attendance/sessions/${selectedSession.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ records, lock }),
      });
      setActionSuccess(res.message);
      // Reload lectures list and current session
      await loadLectures();
    } catch (err: any) {
      setActionError(err.message || "Failed to submit attendance");
    } finally {
      setSubmittingAttendance(false);
    }
  }

  // --- Marks functions ---
  async function loadMarksForAssignment(assignId: number) {
    try {
      const res = await apiFetch<any>(`/api/marks/assignments/${assignId}`);
      setCurrentAssignMeta(res.assignment);
      setMarksStudents(res.students);
      const initialMarks: Record<number, any> = {};
      res.students.forEach((s: any) => {
        initialMarks[s.student_id] = {
          it1: s.it1 !== null ? String(s.it1) : "",
          it2: s.it2 !== null ? String(s.it2) : "",
          it3: s.it3 !== null ? String(s.it3) : "",
          assignment: s.assignment !== null ? String(s.assignment) : "",
        };
      });
      setMarksData(initialMarks);
    } catch {}
  }

  function handleMarkChange(studentId: number, field: "it1" | "it2" | "it3" | "assignment", val: string) {
    setMarksData((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: val,
      },
    }));
  }

  async function handleSaveMarks() {
    if (!selectedAssignId || !currentAssignMeta) return;
    setSavingMarks(true);
    setActionSuccess(null);
    setActionError(null);

    const payload: any[] = [];
    const maxIt = Number(currentAssignMeta.max_it_marks);
    const maxAssign = Number(currentAssignMeta.max_assignment_marks);

    for (const s of marksStudents) {
      const m = marksData[s.student_id];
      if (!m) continue;

      if (m.it1 !== "") {
        const val = Number(m.it1);
        if (val > maxIt) {
          setActionError(`IT1 mark for ${s.roll_no} (${val}) exceeds maximum of ${maxIt}`);
          setSavingMarks(false);
          return;
        }
        payload.push({ student_id: s.student_id, component: "IT1", marks_obtained: val });
      }
      if (m.it2 !== "") {
        const val = Number(m.it2);
        if (val > maxIt) {
          setActionError(`IT2 mark for ${s.roll_no} (${val}) exceeds maximum of ${maxIt}`);
          setSavingMarks(false);
          return;
        }
        payload.push({ student_id: s.student_id, component: "IT2", marks_obtained: val });
      }
      if (m.it3 !== "") {
        const val = Number(m.it3);
        if (val > maxIt) {
          setActionError(`IT3 mark for ${s.roll_no} (${val}) exceeds maximum of ${maxIt}`);
          setSavingMarks(false);
          return;
        }
        payload.push({ student_id: s.student_id, component: "IT3", marks_obtained: val });
      }
      if (m.assignment !== "") {
        const val = Number(m.assignment);
        if (val > maxAssign) {
          setActionError(`Assignment mark for ${s.roll_no} (${val}) exceeds maximum of ${maxAssign}`);
          setSavingMarks(false);
          return;
        }
        payload.push({ student_id: s.student_id, component: "ASSIGNMENT", marks_obtained: val });
      }
    }

    try {
      const res = await apiFetch<any>("/api/marks/submit", {
        method: "POST",
        body: JSON.stringify({
          subject_assignment_id: selectedAssignId,
          marks: payload,
        }),
      });
      setActionSuccess(res.message);
      await loadMarksForAssignment(selectedAssignId);
    } catch (err: any) {
      setActionError(err.message || "Failed to save marks");
    } finally {
      setSavingMarks(false);
    }
  }

  // --- Statistics functions ---
  async function loadStatsForAssignment(assignId: number) {
    setLoadingStats(true);
    try {
      const res = await apiFetch<any>(`/api/reports/assignments/${assignId}/stats`);
      setStatsData(res);
    } catch {}
    finally {
      setLoadingStats(false);
    }
  }

  async function downloadCsv() {
    if (!statsAssignId) return;
    try {
      const csv = await apiFetch<string>(`/api/reports/assignments/${statsAssignId}?format=csv`);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `class_attendance_marks_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6 gap-2">
          <button
            onClick={() => setActiveTab("lectures")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === "lectures"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Calendar className="w-4 h-4" /> Today&apos;s Lectures & Attendance
          </button>

          <button
            onClick={() => setActiveTab("marks")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === "marks"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Award className="w-4 h-4" /> Internal Marks Entry
          </button>

          <button
            onClick={() => setActiveTab("stats")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === "stats"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Class Statistics & Reports
          </button>
        </div>

        {/* Action Banners */}
        {actionSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2 font-medium">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            {actionSuccess}
          </div>
        )}

        {actionError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2 font-medium">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            {actionError}
          </div>
        )}

        {/* ==================== TAB 1: LECTURES & ATTENDANCE ==================== */}
        {activeTab === "lectures" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Lectures List */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Select Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 text-sm">Scheduled Lectures</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
                    {lectures.length}
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {loadingLectures ? (
                    <div className="p-8 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> Loading...
                    </div>
                  ) : lectures.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">
                      No lectures scheduled on this date.
                    </div>
                  ) : (
                    lectures.map((lec) => {
                      const isSelected = selectedSession?.id === lec.id;
                      return (
                        <button
                          key={lec.id}
                          onClick={() => selectSession(lec)}
                          className={`w-full p-4 text-left transition flex items-center justify-between ${
                            isSelected ? "bg-indigo-50/80 border-l-4 border-indigo-600" : "hover:bg-gray-50"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-gray-900">{lec.subject_code}</span>
                              <span className="text-xs text-gray-500">Period {lec.period_no}</span>
                            </div>
                            <p className="text-xs text-gray-600 truncate mt-0.5">{lec.subject_name}</p>
                            <p className="text-[11px] text-gray-400 mt-1">
                              Sec {lec.section_name} {lec.lab_group_name && `(${lec.lab_group_name})`} &bull; Room {lec.room}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {lec.is_locked ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                <Lock className="w-3 h-3" /> Locked
                              </span>
                            ) : lec.status === "cancelled" ? (
                              <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                                Cancelled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <Unlock className="w-3 h-3" /> Open
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Attendance Marking Interface */}
            <div className="lg:col-span-8">
              {selectedSession ? (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                  {/* Lecture Header */}
                  <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {selectedSession.subject_code}
                          </span>
                          <h2 className="text-lg font-bold text-gray-900">{selectedSession.subject_name}</h2>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Date: <span className="font-semibold text-gray-700">{selectedDate}</span> &bull; Period{" "}
                          <span className="font-semibold text-gray-700">{selectedSession.period_no}</span> ({selectedSession.start_time} - {selectedSession.end_time}) &bull; Room{" "}
                          <span className="font-semibold text-gray-700">{selectedSession.room}</span> &bull; Section{" "}
                          <span className="font-semibold text-gray-700">{selectedSession.section_name}</span>
                        </p>
                      </div>

                      {/* Lock status banner */}
                      <div>
                        {selectedSession.is_locked ? (
                          <div className="bg-purple-100 border border-purple-200 text-purple-900 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                            <Lock className="w-4 h-4 text-purple-700" /> Locked & Held
                          </div>
                        ) : (
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                            <Unlock className="w-4 h-4 text-emerald-600" /> Open for Attendance
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick controls bar */}
                    {!selectedSession.is_locked && (
                      <div className="mt-5 pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setAllAttendance("present")}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition"
                          >
                            Mark All Present
                          </button>
                          <button
                            onClick={() => setAllAttendance("absent")}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition"
                          >
                            Mark All Absent
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => submitAttendance(false)}
                            disabled={submittingAttendance}
                            className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition disabled:opacity-50"
                          >
                            Save Draft
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Are you sure you want to LOCK this lecture? Locked attendance is immutable and cannot be changed later.")) {
                                submitAttendance(true);
                              }
                            }}
                            disabled={submittingAttendance}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                          >
                            <Lock className="w-3.5 h-3.5" /> Lock Attendance
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Student Roll List */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        Enrolled Students ({sessionStudents.length})
                      </span>
                      <span className="text-xs text-gray-500">
                        Present:{" "}
                        <strong className="text-emerald-600">
                          {Object.values(attendanceMap).filter((v) => v === "present").length}
                        </strong>{" "}
                        &bull; Absent:{" "}
                        <strong className="text-red-600">
                          {Object.values(attendanceMap).filter((v) => v === "absent").length}
                        </strong>
                      </span>
                    </div>

                    {loadingStudents ? (
                      <div className="py-12 text-center text-gray-400 text-sm">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
                        Loading student roll...
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                        {sessionStudents.map((st) => {
                          const isPresent = attendanceMap[st.id] === "present";
                          return (
                            <div
                              key={st.id}
                              onClick={() => toggleStudent(st.id)}
                              className={`p-3.5 flex items-center justify-between transition cursor-pointer select-none ${
                                selectedSession.is_locked ? "cursor-default" : "hover:bg-gray-50"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-mono font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                  {st.roll_no}
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{st.full_name}</p>
                                  {st.lab_group_name && (
                                    <span className="text-[11px] text-gray-400">Lab {st.lab_group_name}</span>
                                  )}
                                </div>
                              </div>

                              <div>
                                {isPresent ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <Check className="w-3.5 h-3.5" /> Present
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                                    <XCircle className="w-3.5 h-3.5" /> Absent
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
                  <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-base font-semibold text-gray-700">No Lecture Selected</p>
                  <p className="text-xs text-gray-500 mt-1">Select a lecture from the list on the left to take attendance.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 2: MARKS ENTRY ==================== */}
        {activeTab === "marks" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Internal Marks Entry</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Enter IT1, IT2, IT3, and Assignment marks. Validation against max marks is trigger-enforced.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedAssignId || ""}
                  onChange={(e) => setSelectedAssignId(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.subject_code} - {a.subject_name} (Sec {a.section_name})
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleSaveMarks}
                  disabled={savingMarks}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  {savingMarks ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save All Marks
                </button>
              </div>
            </div>

            {currentAssignMeta && (
              <div className="mb-6 p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 flex flex-wrap items-center justify-between text-xs text-indigo-900 gap-4">
                <span>
                  <strong>Subject:</strong> {currentAssignMeta.subject_code} - {currentAssignMeta.subject_name}
                </span>
                <span>
                  <strong>Max IT Marks:</strong> {currentAssignMeta.max_it_marks}
                </span>
                <span>
                  <strong>Max Assignment Marks:</strong> {currentAssignMeta.max_assignment_marks}
                </span>
                <span>
                  <strong>Students Enrolled:</strong> {marksStudents.length}
                </span>
              </div>
            )}

            {/* Marks Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Roll No</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Student Name</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                      IT 1 (/{currentAssignMeta?.max_it_marks ?? 20})
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                      IT 2 (/{currentAssignMeta?.max_it_marks ?? 20})
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                      IT 3 (/{currentAssignMeta?.max_it_marks ?? 20})
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">
                      Assignment (/{currentAssignMeta?.max_assignment_marks ?? 10})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {marksStudents.map((st) => {
                    const m = marksData[st.student_id] || { it1: "", it2: "", it3: "", assignment: "" };
                    const maxIt = Number(currentAssignMeta?.max_it_marks ?? 20);
                    const maxAssign = Number(currentAssignMeta?.max_assignment_marks ?? 10);

                    const it1Err = m.it1 !== "" && Number(m.it1) > maxIt;
                    const it2Err = m.it2 !== "" && Number(m.it2) > maxIt;
                    const it3Err = m.it3 !== "" && Number(m.it3) > maxIt;
                    const assignErr = m.assignment !== "" && Number(m.assignment) > maxAssign;

                    return (
                      <tr key={st.student_id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-700">{st.roll_no}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{st.full_name}</td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max={maxIt}
                            value={m.it1}
                            onChange={(e) => handleMarkChange(st.student_id, "it1", e.target.value)}
                            placeholder="-"
                            className={`w-20 px-2 py-1 border text-center rounded-md font-semibold text-sm outline-none transition ${
                              it1Err ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 focus:border-indigo-500"
                            }`}
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max={maxIt}
                            value={m.it2}
                            onChange={(e) => handleMarkChange(st.student_id, "it2", e.target.value)}
                            placeholder="-"
                            className={`w-20 px-2 py-1 border text-center rounded-md font-semibold text-sm outline-none transition ${
                              it2Err ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 focus:border-indigo-500"
                            }`}
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max={maxIt}
                            value={m.it3}
                            onChange={(e) => handleMarkChange(st.student_id, "it3", e.target.value)}
                            placeholder="-"
                            className={`w-20 px-2 py-1 border text-center rounded-md font-semibold text-sm outline-none transition ${
                              it3Err ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 focus:border-indigo-500"
                            }`}
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max={maxAssign}
                            value={m.assignment}
                            onChange={(e) => handleMarkChange(st.student_id, "assignment", e.target.value)}
                            placeholder="-"
                            className={`w-20 px-2 py-1 border text-center rounded-md font-semibold text-sm outline-none transition ${
                              assignErr ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 focus:border-indigo-500"
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: CLASS STATISTICS & REPORTS ==================== */}
        {activeTab === "stats" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Class Performance & Attendance Analytics</h2>
                <p className="text-xs text-gray-500 mt-0.5">Aggregate statistics and eligibility overview.</p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={statsAssignId || ""}
                  onChange={(e) => setStatsAssignId(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.subject_code} - {a.subject_name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={downloadCsv}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
            </div>

            {loadingStats || !statsData ? (
              <div className="p-16 text-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                Loading analytics...
              </div>
            ) : (
              <>
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Students</p>
                    <p className="text-3xl font-extrabold text-gray-900 mt-2">{statsData.totalStudents}</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Average Attendance</p>
                    <p className="text-3xl font-extrabold text-indigo-600 mt-2">{statsData.averageAttendancePct}%</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Eligible (&ge;75%)</p>
                    <p className="text-3xl font-extrabold text-emerald-600 mt-2">{statsData.eligibleCount}</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Shortage (&lt;75%)</p>
                    <p className="text-3xl font-extrabold text-red-600 mt-2">{statsData.belowThresholdCount}</p>
                  </div>
                </div>

                {/* Chart & Component Averages */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Attendance Bracket Distribution</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { range: "< 50%", count: statsData.distribution.under50, color: "#ef4444" },
                            { range: "50% - 74%", count: statsData.distribution.fiftyTo75, color: "#f59e0b" },
                            { range: "75% - 84%", count: statsData.distribution.seventyFiveTo85, color: "#10b981" },
                            { range: "> 85%", count: statsData.distribution.above85, color: "#059669" },
                          ]}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                            {["#ef4444", "#f59e0b", "#10b981", "#059669"].map((color, index) => (
                              <Cell key={`cell-${index}`} fill={color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
                    <h3 className="text-sm font-bold text-gray-900 mb-4">Class Marks Averages</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <span className="text-xs font-semibold text-gray-600">IT 1 Average</span>
                        <span className="text-base font-bold text-gray-900">
                          {statsData.marksAverages.it1 !== null ? `${statsData.marksAverages.it1} / 20` : "Pending"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <span className="text-xs font-semibold text-gray-600">IT 2 Average</span>
                        <span className="text-base font-bold text-gray-900">
                          {statsData.marksAverages.it2 !== null ? `${statsData.marksAverages.it2} / 20` : "Pending"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <span className="text-xs font-semibold text-gray-600">IT 3 Average</span>
                        <span className="text-base font-bold text-gray-900">
                          {statsData.marksAverages.it3 !== null ? `${statsData.marksAverages.it3} / 20` : "Pending"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                        <span className="text-xs font-semibold text-gray-600">Assignment Average</span>
                        <span className="text-base font-bold text-gray-900">
                          {statsData.marksAverages.assignment !== null ? `${statsData.marksAverages.assignment} / 10` : "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
