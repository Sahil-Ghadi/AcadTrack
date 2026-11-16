"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { apiFetch, getStoredUser } from "@/lib/api";
import {
  Calendar,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  AlertTriangle,
  Download,
  Upload,
  Users,
  Award,
  BarChart3,
  Loader2,
  Check,
  ChevronRight,
  Clock,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import CsvImportWizard from "@/components/CsvImportWizard";
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
  const [showAttendanceImportModal, setShowAttendanceImportModal] = useState(false);
  const [downloadingAttendanceTemplate, setDownloadingAttendanceTemplate] = useState(false);

  // --- Tab 2: Marks Entry State ---
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignId, setSelectedAssignId] = useState<number | null>(null);
  const [marksComponent, setMarksComponent] = useState<"IT1" | "IT2" | "IT3" | "ASSIGNMENT">("IT1");
  const [marksStudents, setMarksStudents] = useState<any[]>([]);
  const [marksData, setMarksData] = useState<
    Record<number, { it1: string; it2: string; it3: string; assignment: string }>
  >({});
  const [currentAssignMeta, setCurrentAssignMeta] = useState<any | null>(null);
  const [savingMarks, setSavingMarks] = useState(false);
  const [showMarksImportModal, setShowMarksImportModal] = useState(false);
  const [downloadingMarksTemplate, setDownloadingMarksTemplate] = useState(false);

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
      await loadLectures();
    } catch (err: any) {
      setActionError(err.message || "Failed to submit attendance");
    } finally {
      setSubmittingAttendance(false);
    }
  }

  // --- Template Download Handlers ---
  async function handleDownloadAttendanceTemplate() {
    if (!selectedSession) return;
    setDownloadingAttendanceTemplate(true);
    try {
      const csvText = await apiFetch<string>(
        `/api/import/template/attendance?session_id=${selectedSession.id}`,
      );
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance_template_${selectedDate}_period_${selectedSession.period_no}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionError(err.message || "Failed to download attendance template");
    } finally {
      setDownloadingAttendanceTemplate(false);
    }
  }

  async function handleDownloadMarksTemplate() {
    if (!selectedAssignId) return;
    setDownloadingMarksTemplate(true);
    try {
      const csvText = await apiFetch<string>(
        `/api/import/template/marks?assignment_id=${selectedAssignId}&component=${marksComponent}`,
      );
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cleanCode = (currentAssignMeta?.subject_code || "subject").replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `marks_template_${cleanCode}_${marksComponent}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionError(err.message || "Failed to download marks template");
    } finally {
      setDownloadingMarksTemplate(false);
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
    } catch {} finally {
      setLoadingStats(false);
    }
  }

  async function handleExportClassCsv() {
    if (!statsAssignId) return;
    try {
      const csvText = await apiFetch<string>(`/api/reports/assignments/${statsAssignId}?format=csv`);
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `class_report_assignment_${statsAssignId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setActionError(err.message || "Failed to export report CSV");
    }
  }

  const user = getStoredUser();

  return (
    <div className="min-h-screen bg-[#FFF9F7] flex flex-col font-sans selection:bg-[#F0E5F7] selection:text-[#55368F]">
      {/* ================= SHARED APPLICATION HEADER & HORIZONTAL NAV (NO SIDEBAR) ================= */}
      <AppHeader
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as any)}
        termText="AY 2026-27 • Even Semester (Active)"
        statusBadge="Faculty Portal Active"
        navItems={[
          { key: "lectures", label: "Lectures & Attendance", icon: Calendar },
          { key: "marks", label: "Internal Marks Entry", icon: Award },
          { key: "stats", label: "Class Statistics & Reports", icon: BarChart3 },
        ]}
      />

      <main className="w-full flex-1 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Breadcrumb Context */}
        <div className="flex items-center justify-between text-xs text-[#777080] mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#7150B5]">
              <Users className="w-4 h-4" /> Faculty Portal
            </span>
            <span>/</span>
            <span className="text-[#29232F] font-semibold">
              {activeTab === "lectures"
                ? "Today's Lectures & Attendance"
                : activeTab === "marks"
                ? "Internal Assessment Marks"
                : "Course Analytics & Reports"}
            </span>
            <span>/</span>
            <span className="px-2 py-0.5 rounded-md bg-[#F0E5F7] text-[#55368F] font-semibold text-[11px]">
              {user?.email || "Faculty Workspace"}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-medium text-[#777080]">Trigger Attendance Immutability Enabled</span>
          </div>
        </div>

        {/* Global Notifications */}
        {actionSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button
              onClick={() => setActionSuccess(null)}
              className="text-emerald-700 hover:text-emerald-900 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {actionError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-red-700 hover:text-red-900 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* ================= TAB 1: TODAY'S LECTURES & ATTENDANCE ================= */}
        {activeTab === "lectures" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Scheduled Lectures Navigator */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-[#EAE2EA] shadow-xs">
                <label className="block text-[11px] font-bold text-[#777080] uppercase tracking-wider mb-2">
                  Session Date Selector
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#EAE2EA] rounded-xl text-xs font-bold text-[#29232F] outline-none focus:border-[#7150B5] bg-[#FFF9F7]"
                />
              </div>

              {/* Lecture List */}
              <div className="bg-white rounded-2xl border border-[#EAE2EA] shadow-xs overflow-hidden">
                <div className="p-4 border-b border-[#EAE2EA] flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#777080]">
                    Scheduled Lectures ({lectures.length})
                  </h3>
                  <span className="text-[11px] font-semibold text-[#7150B5] bg-[#F0E5F7] px-2 py-0.5 rounded-full">
                    {selectedDate}
                  </span>
                </div>

                <div className="divide-y divide-[#EAE2EA]/70">
                  {loadingLectures ? (
                    <div className="p-8 text-center text-xs text-[#777080] flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#7150B5]" />
                      <span>Loading scheduled sessions...</span>
                    </div>
                  ) : lectures.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#777080]">
                      No lectures scheduled on this date.
                    </div>
                  ) : (
                    lectures.map((lec) => {
                      const isSelected = selectedSession?.id === lec.id;
                      return (
                        <button
                          key={lec.id}
                          type="button"
                          onClick={() => selectSession(lec)}
                          className={`w-full p-4 text-left transition flex items-center justify-between ${
                            isSelected
                              ? "bg-[#F0E5F7]/60 border-l-4 border-[#7150B5]"
                              : "hover:bg-[#FFF9F7]/70"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-[#7150B5]">
                                {lec.subject_code}
                              </span>
                              <span className="text-xs font-semibold text-[#29232F]">
                                Period {lec.period_no}
                              </span>
                            </div>
                            <p className="text-xs text-[#29232F] font-medium truncate mt-0.5">
                              {lec.subject_name}
                            </p>
                            <p className="text-[11px] text-[#777080] mt-1">
                              Sec {lec.section_name} {lec.lab_group_name && `(${lec.lab_group_name})`} &bull; Room {lec.room}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                            {lec.is_locked ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-800 bg-[#F0E5F7] px-2 py-0.5 rounded-full border border-purple-200">
                                <Lock className="w-3 h-3 text-[#7150B5]" /> Locked
                              </span>
                            ) : lec.status === "cancelled" ? (
                              <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                Cancelled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <Unlock className="w-3 h-3 text-emerald-600" /> Open
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-[#777080]" />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Attendance Register & Student Roll */}
            <div className="lg:col-span-8">
              {selectedSession ? (
                <div className="bg-white rounded-2xl border border-[#EAE2EA] shadow-xs overflow-hidden">
                  {/* Session Header */}
                  <div className="p-6 border-b border-[#EAE2EA] bg-[#FFFDFB]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[#7150B5] bg-[#F0E5F7] px-2 py-0.5 rounded-md border border-[#7150B5]/20">
                            {selectedSession.subject_code}
                          </span>
                          <h2 className="text-base sm:text-lg font-bold text-[#29232F]">
                            {selectedSession.subject_name}
                          </h2>
                        </div>
                        <p className="text-xs text-[#777080] mt-1">
                          Period <strong className="text-[#29232F]">{selectedSession.period_no}</strong> ({selectedSession.start_time} - {selectedSession.end_time}) &bull; Room{" "}
                          <strong className="text-[#29232F]">{selectedSession.room}</strong> &bull; Section{" "}
                          <strong className="text-[#29232F]">{selectedSession.section_name}</strong>
                          {selectedSession.lab_group_name && (
                            <>
                              {" "}&bull; Lab Group{" "}
                              <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                                {selectedSession.lab_group_name}
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Lock Status Pill */}
                      <div>
                        {selectedSession.is_locked ? (
                          <div className="bg-[#F0E5F7] border border-[#7150B5]/30 text-[#55368F] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                            <Lock className="w-4 h-4 text-[#7150B5]" /> Locked &amp; Held
                          </div>
                        ) : (
                          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                            <Unlock className="w-4 h-4 text-emerald-600" /> Open for Attendance
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Controls Bar */}
                    {!selectedSession.is_locked && (
                      <div className="mt-5 pt-4 border-t border-[#EAE2EA] flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAllAttendance("present")}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold transition"
                          >
                            Mark All Present
                          </button>
                          <button
                            type="button"
                            onClick={() => setAllAttendance("absent")}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-xl text-xs font-semibold transition"
                          >
                            Mark All Absent
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => submitAttendance(false)}
                            disabled={submittingAttendance}
                            className="px-4 py-1.5 bg-[#FFF9F7] hover:bg-[#F0E5F7]/50 border border-[#EAE2EA] text-[#29232F] rounded-xl text-xs font-bold transition disabled:opacity-50"
                          >
                            Save Draft
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Are you sure you want to LOCK this lecture? Locked attendance is immutable and cannot be changed later.")) {
                                submitAttendance(true);
                              }
                            }}
                            disabled={submittingAttendance}
                            className="px-4 py-1.5 bg-[#7150B5] hover:bg-[#55368F] text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                          >
                            <Lock className="w-3.5 h-3.5" /> Lock Attendance
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bulk CSV Operations Bar */}
                    <div className="mt-4 pt-3 border-t border-[#EAE2EA] flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-[#777080]">CSV Bulk Operations:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleDownloadAttendanceTemplate}
                          disabled={downloadingAttendanceTemplate}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#EAE2EA] bg-white text-[#29232F] hover:bg-[#FFF9F7] text-xs font-semibold transition disabled:opacity-50"
                        >
                          {downloadingAttendanceTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7150B5]" /> : <Download className="w-3.5 h-3.5 text-[#7150B5]" />}
                          Download Attendance Template
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAttendanceImportModal(true)}
                          disabled={selectedSession.is_locked || selectedSession.status === "cancelled"}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0E5F7] border border-[#7150B5]/20 text-[#55368F] hover:bg-[#F0E5F7]/80 text-xs font-bold transition disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#7150B5]" />
                          Import Attendance CSV
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Student Roll List */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <span className="font-bold uppercase tracking-wider text-[#777080]">
                        Enrolled Students ({sessionStudents.length})
                      </span>
                      <span className="text-[#777080]">
                        Present:{" "}
                        <strong className="text-emerald-700">
                          {Object.values(attendanceMap).filter((v) => v === "present").length}
                        </strong>{" "}
                        &bull; Absent:{" "}
                        <strong className="text-[#D96F79]">
                          {Object.values(attendanceMap).filter((v) => v === "absent").length}
                        </strong>
                      </span>
                    </div>

                    {loadingStudents ? (
                      <div className="py-12 text-center text-xs text-[#777080]">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#7150B5] mb-2" />
                        Loading student roll...
                      </div>
                    ) : (
                      <div className="divide-y divide-[#EAE2EA] border border-[#EAE2EA] rounded-2xl overflow-hidden bg-white">
                        {sessionStudents.map((st) => {
                          const isPresent = attendanceMap[st.id] === "present";
                          return (
                            <div
                              key={st.id}
                              onClick={() => toggleStudent(st.id)}
                              className={`p-3.5 flex items-center justify-between transition cursor-pointer select-none ${
                                isPresent ? "hover:bg-emerald-50/30" : "bg-red-50/20 hover:bg-red-50/40"
                              } ${selectedSession.is_locked ? "cursor-default" : ""}`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-xs font-bold text-[#7150B5] bg-[#F0E5F7] px-2 py-0.5 rounded-md">
                                  {st.roll_no}
                                </span>
                                <div>
                                  <p className="text-xs font-bold text-[#29232F]">{st.full_name}</p>
                                  {st.lab_group_name && (
                                    <span className="text-[10px] text-[#777080] font-medium">
                                      {st.lab_group_name}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={selectedSession.is_locked}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                                  isPresent
                                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                    : "bg-red-100 text-red-800 hover:bg-red-200"
                                }`}
                              >
                                {isPresent ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" /> Present
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3.5 h-3.5" /> Absent
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#EAE2EA] p-12 text-center text-[#777080]">
                  <Calendar className="w-12 h-12 mx-auto text-[#777080]/40 mb-3" />
                  <p className="text-base font-bold text-[#29232F]">No Lecture Selected</p>
                  <p className="text-xs text-[#777080] mt-1">
                    Select a lecture from the schedule list on the left to review or mark attendance.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: INTERNAL MARKS ENTRY ================= */}
        {activeTab === "marks" && (
          <div className="bg-white rounded-2xl border border-[#EAE2EA] shadow-xs p-6 sm:p-8 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#EAE2EA]">
              <div>
                <h2 className="text-xl font-bold text-[#29232F]">Internal Assessment Marks Entry</h2>
                <p className="text-xs text-[#777080] mt-1">
                  Enter IT1, IT2, IT3, and Assignment scores with database trigger-enforced max marks validation.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Subject Selector */}
                <select
                  value={selectedAssignId || ""}
                  onChange={(e) => setSelectedAssignId(Number(e.target.value))}
                  className="px-3.5 py-2 border border-[#EAE2EA] rounded-xl text-xs font-bold text-[#29232F] bg-[#FFF9F7] outline-none focus:border-[#7150B5]"
                >
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.subject_code} - {a.subject_name} (Sec {a.section_name})
                    </option>
                  ))}
                </select>

                {/* Assessment Component Selector */}
                <select
                  value={marksComponent}
                  onChange={(e) => setMarksComponent(e.target.value as any)}
                  className="px-3.5 py-2 border border-[#EAE2EA] rounded-xl text-xs font-bold text-[#7150B5] bg-[#F0E5F7] outline-none focus:border-[#7150B5]"
                >
                  <option value="IT1">IT1 (Test 1)</option>
                  <option value="IT2">IT2 (Test 2)</option>
                  <option value="IT3">IT3 (Test 3)</option>
                  <option value="ASSIGNMENT">Assignment</option>
                </select>

                {/* Bulk Download & Import Actions */}
                <button
                  type="button"
                  onClick={handleDownloadMarksTemplate}
                  disabled={!selectedAssignId || downloadingMarksTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#EAE2EA] text-[#29232F] hover:bg-[#FFF9F7] text-xs font-semibold transition disabled:opacity-50"
                >
                  {downloadingMarksTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7150B5]" /> : <Download className="w-3.5 h-3.5 text-[#7150B5]" />}
                  Download Template
                </button>

                <button
                  type="button"
                  onClick={() => setShowMarksImportModal(true)}
                  disabled={!selectedAssignId}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F0E5F7] border border-[#7150B5]/20 text-[#55368F] hover:bg-[#F0E5F7]/80 text-xs font-bold transition disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5 text-[#7150B5]" />
                  Import Marks CSV
                </button>

                {/* Save All Button */}
                <button
                  type="button"
                  onClick={handleSaveMarks}
                  disabled={savingMarks}
                  className="px-4 py-2 bg-[#7150B5] hover:bg-[#55368F] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  {savingMarks ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save All Marks
                </button>
              </div>
            </div>

            {currentAssignMeta && (
              <div className="p-4 rounded-2xl bg-[#FFF9F7] border border-[#EAE2EA] flex flex-wrap items-center justify-between text-xs text-[#29232F] gap-4">
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

            {/* Marks Entry Table */}
            <div className="overflow-x-auto border border-[#EAE2EA] rounded-2xl">
              <table className="min-w-full divide-y divide-[#EAE2EA] text-xs">
                <thead className="bg-[#FFF9F7]">
                  <tr>
                    <th className="px-5 py-3 text-left font-bold text-[#777080] uppercase tracking-wider">
                      Roll No
                    </th>
                    <th className="px-5 py-3 text-left font-bold text-[#777080] uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                      IT 1 (/{currentAssignMeta?.max_it_marks ?? 20})
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                      IT 2 (/{currentAssignMeta?.max_it_marks ?? 20})
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                      IT 3 (/{currentAssignMeta?.max_it_marks ?? 20})
                    </th>
                    <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                      Assignment (/{currentAssignMeta?.max_assignment_marks ?? 10})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE2EA]/70 bg-white">
                  {marksStudents.map((st) => {
                    const m = marksData[st.student_id] || { it1: "", it2: "", it3: "", assignment: "" };
                    const maxIt = Number(currentAssignMeta?.max_it_marks ?? 20);
                    const maxAssign = Number(currentAssignMeta?.max_assignment_marks ?? 10);

                    const it1Err = m.it1 !== "" && Number(m.it1) > maxIt;
                    const it2Err = m.it2 !== "" && Number(m.it2) > maxIt;
                    const it3Err = m.it3 !== "" && Number(m.it3) > maxIt;
                    const assignErr = m.assignment !== "" && Number(m.assignment) > maxAssign;

                    return (
                      <tr key={st.student_id} className="hover:bg-[#FFF9F7]/70 transition-colors">
                        <td className="px-5 py-3 font-mono font-bold text-[#7150B5]">{st.roll_no}</td>
                        <td className="px-5 py-3 font-semibold text-[#29232F]">{st.full_name}</td>
                        <td className="px-4 py-2 text-center">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max={maxIt}
                            value={m.it1}
                            onChange={(e) => handleMarkChange(st.student_id, "it1", e.target.value)}
                            placeholder="-"
                            className={`w-20 px-2 py-1 border text-center rounded-lg font-bold text-xs outline-none transition ${
                              it1Err
                                ? "border-red-500 bg-red-50 text-red-700"
                                : "border-[#EAE2EA] focus:border-[#7150B5]"
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
                            className={`w-20 px-2 py-1 border text-center rounded-lg font-bold text-xs outline-none transition ${
                              it2Err
                                ? "border-red-500 bg-red-50 text-red-700"
                                : "border-[#EAE2EA] focus:border-[#7150B5]"
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
                            className={`w-20 px-2 py-1 border text-center rounded-lg font-bold text-xs outline-none transition ${
                              it3Err
                                ? "border-red-500 bg-red-50 text-red-700"
                                : "border-[#EAE2EA] focus:border-[#7150B5]"
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
                            className={`w-20 px-2 py-1 border text-center rounded-lg font-bold text-xs outline-none transition ${
                              assignErr
                                ? "border-red-500 bg-red-50 text-red-700"
                                : "border-[#EAE2EA] focus:border-[#7150B5]"
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

        {/* ================= TAB 3: CLASS STATISTICS & REPORTS ================= */}
        {activeTab === "stats" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE2EA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#29232F]">Class Statistics &amp; Analytics</h2>
                <p className="text-xs text-[#777080] mt-1">
                  Attendance threshold compliance, internal marks distributions, and consolidated reporting.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={statsAssignId || ""}
                  onChange={(e) => setStatsAssignId(Number(e.target.value))}
                  className="px-3.5 py-2 border border-[#EAE2EA] rounded-xl text-xs font-bold text-[#29232F] bg-[#FFF9F7] outline-none focus:border-[#7150B5]"
                >
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.subject_code} - {a.subject_name} (Sec {a.section_name})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleExportClassCsv}
                  disabled={!statsAssignId}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#7150B5] hover:bg-[#55368F] text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Report CSV</span>
                </button>
              </div>
            </div>

            {loadingStats ? (
              <div className="py-16 text-center text-xs text-[#777080] flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#7150B5]" />
                <span>Loading class analytics...</span>
              </div>
            ) : !statsData ? (
              <div className="p-8 text-center text-xs text-[#777080]">No statistics available.</div>
            ) : (
              <>
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-[#EAE2EA] shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#777080]">Total Students</p>
                    <p className="text-3xl font-extrabold text-[#29232F] mt-2">{statsData.totalStudents}</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#EAE2EA] shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#777080]">Average Attendance</p>
                    <p className="text-3xl font-extrabold text-[#7150B5] mt-2">{statsData.averageAttendancePct}%</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#EAE2EA] shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#777080]">Eligible (&ge;75%)</p>
                    <p className="text-3xl font-extrabold text-emerald-700 mt-2">{statsData.eligibleCount}</p>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-[#EAE2EA] shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#777080]">Shortage (&lt;75%)</p>
                    <p className="text-3xl font-extrabold text-[#D96F79] mt-2">{statsData.belowThresholdCount}</p>
                  </div>
                </div>

                {/* Chart & Component Averages */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-[#EAE2EA] shadow-xs">
                    <h3 className="text-sm font-bold text-[#29232F] mb-4">Attendance Bracket Distribution</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { range: "< 50%", count: statsData.distribution.under50, color: "#D96F79" },
                            { range: "50-65%", count: statsData.distribution.under65, color: "#D99A43" },
                            { range: "65-75%", count: statsData.distribution.under75, color: "#E09F3E" },
                            { range: "75-85%", count: statsData.distribution.under85, color: "#7150B5" },
                            { range: "> 85%", count: statsData.distribution.above85, color: "#279B78" },
                          ]}
                        >
                          <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#777080" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#777080" }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#FFFDFB",
                              borderColor: "#EAE2EA",
                              borderRadius: "0.75rem",
                              fontSize: "12px",
                            }}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {statsData &&
                              [
                                "#D96F79",
                                "#D99A43",
                                "#E09F3E",
                                "#7150B5",
                                "#279B78",
                              ].map((c, i) => <Cell key={i} fill={c} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-[#EAE2EA] shadow-xs flex flex-col justify-between">
                    <h3 className="text-sm font-bold text-[#29232F] mb-3">Assessment Averages</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA]">
                        <span className="text-xs font-semibold text-[#777080]">IT 1 Average</span>
                        <span className="text-sm font-bold text-[#29232F]">
                          {statsData.marksAverages.it1 !== null ? `${statsData.marksAverages.it1} / 20` : "Pending"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA]">
                        <span className="text-xs font-semibold text-[#777080]">IT 2 Average</span>
                        <span className="text-sm font-bold text-[#29232F]">
                          {statsData.marksAverages.it2 !== null ? `${statsData.marksAverages.it2} / 20` : "Pending"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA]">
                        <span className="text-xs font-semibold text-[#777080]">IT 3 Average</span>
                        <span className="text-sm font-bold text-[#29232F]">
                          {statsData.marksAverages.it3 !== null ? `${statsData.marksAverages.it3} / 20` : "Pending"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA]">
                        <span className="text-xs font-semibold text-[#777080]">Assignment Average</span>
                        <span className="text-sm font-bold text-[#29232F]">
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

        {/* ================= MARKS IMPORT MODAL ================= */}
        {showMarksImportModal && selectedAssignId && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="relative w-full max-w-4xl my-8">
              <CsvImportWizard
                entityType="marks"
                assignmentId={selectedAssignId}
                component={marksComponent}
                templateUrl={`/api/import/template/marks?assignment_id=${selectedAssignId}&component=${marksComponent}`}
                templateFilename={`marks_template_${(currentAssignMeta?.subject_code || "subject").replace(/[^a-zA-Z0-9_-]/g, "_")}_${marksComponent}.csv`}
                onCancel={() => setShowMarksImportModal(false)}
                onComplete={() => {
                  loadMarksForAssignment(selectedAssignId);
                  setShowMarksImportModal(false);
                  setActionSuccess(`Marks for ${marksComponent} imported successfully!`);
                }}
              />
            </div>
          </div>
        )}

        {/* ================= ATTENDANCE IMPORT MODAL ================= */}
        {showAttendanceImportModal && selectedSession && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="relative w-full max-w-4xl my-8">
              <CsvImportWizard
                entityType="attendance"
                sessionId={selectedSession.id}
                templateUrl={`/api/import/template/attendance?session_id=${selectedSession.id}`}
                templateFilename={`attendance_template_${selectedDate}_period_${selectedSession.period_no}.csv`}
                onCancel={() => setShowAttendanceImportModal(false)}
                onComplete={() => {
                  selectSession(selectedSession);
                  loadLectures();
                  setShowAttendanceImportModal(false);
                  setActionSuccess(`Attendance for lecture period ${selectedSession.period_no} imported successfully!`);
                }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
