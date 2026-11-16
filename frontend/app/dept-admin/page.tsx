"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { apiFetch, getStoredUser } from "@/lib/api";
import {
  BookOpen,
  Calendar,
  Users,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers,
  Loader2,
  Trash2,
  FileSpreadsheet,
  Download,
  Check,
  ShieldAlert,
  ChevronDown,
} from "lucide-react";
import CsvImportWizard from "@/components/CsvImportWizard";

export default function DeptAdminDashboard() {
  const [activeTab, setActiveTab] = useState<"timetable" | "subjects" | "assignments" | "import">("timetable");
  const [importType, setImportType] = useState<"student" | "faculty" | "timetable">("student");
  const [showImportTimetableModal, setShowImportTimetableModal] = useState(false);

  // Timetable state
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>("all");
  const [slotForm, setSlotForm] = useState({
    subject_assignment_id: "",
    day_of_week: "1",
    period_no: "1",
    start_time: "09:00",
    end_time: "10:00",
    room: "R204",
  });

  // Subjects state
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [subjectForm, setSubjectForm] = useState({
    code: "",
    name: "",
    subject_type: "theory" as "theory" | "lab",
    semester: "5",
    is_elective: false,
    max_it_marks: "20",
    max_assignment_marks: "10",
  });

  // Assignments & Faculty state
  const [assignments, setAssignments] = useState<any[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [currentTerm, setCurrentTerm] = useState<any | null>(null);
  const [showAddAssign, setShowAddAssign] = useState(false);
  const [sectionLabGroups, setSectionLabGroups] = useState<any[]>([]);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [assignForm, setAssignForm] = useState({
    subject_id: "",
    faculty_id: "",
    section_id: "",
    lab_group_id: "",
  });

  // Notification banners
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadSectionLabGroups(sectionId: string | number) {
    if (!sectionId) {
      setSectionLabGroups([]);
      return;
    }
    try {
      const lgs = await apiFetch<any[]>(`/api/institution/lab-groups?section_id=${sectionId}`);
      setSectionLabGroups(lgs);
    } catch {
      setSectionLabGroups([]);
    }
  }

  async function loadAllData() {
    setLoadingSlots(true);
    setLoadingSubjects(true);
    try {
      const [sRes, subRes, aRes, fRes, secRes, tRes] = await Promise.all([
        apiFetch<any[]>("/api/timetable/slots"),
        apiFetch<any[]>("/api/academic/subjects"),
        apiFetch<any[]>("/api/academic/assignments"),
        apiFetch<any[]>("/api/academic/faculty"),
        apiFetch<any[]>("/api/institution/sections"),
        apiFetch<any>("/api/institution/academic-terms/current"),
      ]);

      setSlots(sRes);
      setSubjects(subRes);
      setAssignments(aRes);
      setFacultyList(fRes);
      setSections(secRes);
      setCurrentTerm(tRes);

      if (aRes.length > 0) {
        setSlotForm((prev) => ({ ...prev, subject_assignment_id: String(aRes[0].id) }));
      }
      if (subRes.length > 0 && fRes.length > 0 && secRes.length > 0) {
        setAssignForm({
          subject_id: String(subRes[0].id),
          faculty_id: String(fRes[0].id),
          section_id: String(secRes[0].id),
          lab_group_id: "",
        });
        loadSectionLabGroups(secRes[0].id);
      }
    } catch {} finally {
      setLoadingSlots(false);
      setLoadingSubjects(false);
    }
  }

  // Add Timetable Slot with Clash Detection
  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    setBannerSuccess(null);
    setBannerError(null);

    try {
      await apiFetch<any>("/api/timetable/slots", {
        method: "POST",
        body: JSON.stringify({
          subject_assignment_id: Number(slotForm.subject_assignment_id),
          day_of_week: Number(slotForm.day_of_week),
          period_no: Number(slotForm.period_no),
          start_time: slotForm.start_time,
          end_time: slotForm.end_time,
          room: slotForm.room,
        }),
      });

      setBannerSuccess("Timetable slot scheduled successfully!");
      setShowAddSlot(false);
      const updated = await apiFetch<any[]>("/api/timetable/slots");
      setSlots(updated);
    } catch (err: any) {
      setBannerError(err.message || "Failed to schedule slot (possible timetable clash)");
    }
  }

  async function handleDeleteSlot(id: number) {
    if (!confirm("Are you sure you want to remove this timetable slot?")) return;
    try {
      await apiFetch(`/api/timetable/slots/${id}`, { method: "DELETE" });
      setBannerSuccess("Slot deleted successfully");
      const updated = await apiFetch<any[]>("/api/timetable/slots");
      setSlots(updated);
    } catch (err: any) {
      setBannerError(err.message || "Cannot delete slot (it may have scheduled lecture sessions)");
    }
  }

  // Add Subject
  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    setBannerSuccess(null);
    setBannerError(null);

    try {
      await apiFetch<any>("/api/academic/subjects", {
        method: "POST",
        body: JSON.stringify({
          department_id: 1, // Department scoped
          code: subjectForm.code.toUpperCase(),
          name: subjectForm.name,
          subject_type: subjectForm.subject_type,
          semester: Number(subjectForm.semester),
          is_elective: subjectForm.is_elective,
          max_it_marks: Number(subjectForm.max_it_marks),
          max_assignment_marks: Number(subjectForm.max_assignment_marks),
        }),
      });

      setBannerSuccess("Subject added successfully!");
      setShowAddSubject(false);
      const subRes = await apiFetch<any[]>("/api/academic/subjects");
      setSubjects(subRes);
    } catch (err: any) {
      setBannerError(err.message || "Failed to add subject");
    }
  }

  // Add Assignment
  async function handleAddAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTerm) return;
    setBannerSuccess(null);
    setBannerError(null);

    try {
      await apiFetch<any>("/api/academic/assignments", {
        method: "POST",
        body: JSON.stringify({
          subject_id: Number(assignForm.subject_id),
          faculty_id: Number(assignForm.faculty_id),
          section_id: Number(assignForm.section_id),
          lab_group_id: assignForm.lab_group_id ? Number(assignForm.lab_group_id) : null,
          term_id: currentTerm.id,
        }),
      });

      setBannerSuccess("Subject assigned to faculty successfully!");
      setShowAddAssign(false);
      const aRes = await apiFetch<any[]>("/api/academic/assignments");
      setAssignments(aRes);
    } catch (err: any) {
      setBannerError(err.message || "Failed to assign subject");
    }
  }

  // Export Timetable CSV
  async function handleExportCsv() {
    if (!currentTerm) {
      setBannerError("No active academic term selected for timetable export");
      return;
    }
    setExportingCsv(true);
    setBannerError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("acadtrack_token") : null;
      const query = new URLSearchParams({
        term_id: String(currentTerm.id),
      });
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/timetable/slots/export-csv?${query.toString()}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ message: "Export failed" }));
        throw new Error(errJson.message || `Export failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timetable_${currentTerm.academic_year}_${currentTerm.term_type}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setBannerSuccess("Timetable CSV downloaded successfully!");
    } catch (err: any) {
      setBannerError(err.message || "Failed to download timetable CSV");
    } finally {
      setExportingCsv(false);
    }
  }

  const days = [
    { num: 1, name: "Monday" },
    { num: 2, name: "Tuesday" },
    { num: 3, name: "Wednesday" },
    { num: 4, name: "Thursday" },
    { num: 5, name: "Friday" },
    { num: 6, name: "Saturday" },
  ];

  const periods = [1, 2, 3, 4, 5, 6];

  const user = getStoredUser();
  const termDisplay = currentTerm
    ? `AY ${currentTerm.academic_year} • ${currentTerm.term_type === "even" ? "Even" : "Odd"} Semester (Active)`
    : "AY 2026-27 • Active Term";

  // Filter slots by selected section
  const filteredSlots = selectedSectionFilter === "all"
    ? slots
    : slots.filter((s) => String(s.section_id) === selectedSectionFilter);

  return (
    <div className="min-h-screen bg-[#FFF9F7] flex flex-col font-sans selection:bg-[#F0E5F7] selection:text-[#55368F]">
      {/* ================= SHARED APPLICATION HEADER & HORIZONTAL NAV (NO SIDEBAR) ================= */}
      <AppHeader
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as any)}
        termText={termDisplay}
        statusBadge="Clash Engine Active"
        navItems={[
          { key: "timetable", label: "Timetable Grid", icon: Calendar },
          { key: "subjects", label: "Subjects Curriculum", icon: BookOpen },
          { key: "assignments", label: "Faculty Assignments", icon: Users },
          { key: "import", label: "CSV Data Import", icon: FileSpreadsheet },
        ]}
      />

      <main className="w-full flex-1 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Breadcrumb Context */}
        <div className="flex items-center justify-between text-xs text-[#777080] mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#7150B5]">
              <Layers className="w-4 h-4" /> Department Administration
            </span>
            <span>/</span>
            <span className="text-[#29232F] font-semibold">
              {activeTab === "timetable"
                ? "Weekly Master Timetable"
                : activeTab === "subjects"
                ? "Curriculum & Syllabi"
                : activeTab === "assignments"
                ? "Teaching Allocations"
                : "Departmental Data Import"}
            </span>
            <span>/</span>
            <span className="px-2 py-0.5 rounded-md bg-[#F0E5F7] text-[#55368F] font-semibold text-[11px]">
              Computer Engineering
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-medium text-[#777080]">Trigger Clash Guard Enabled</span>
          </div>
        </div>

        {/* Global Notifications */}
        {bannerSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{bannerSuccess}</span>
            </div>
            <button
              onClick={() => setBannerSuccess(null)}
              className="text-emerald-700 hover:text-emerald-900 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {bannerError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{bannerError}</span>
            </div>
            <button
              onClick={() => setBannerError(null)}
              className="text-red-700 hover:text-red-900 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* ================= TAB 1: TIMETABLE GRID & CLASH PREVENTION ================= */}
        {activeTab === "timetable" && (
          <div className="space-y-6">
            {/* Operational Header & Controls Strip */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE2EA] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F3DDD0] text-[#29232F] font-semibold text-[11px] uppercase tracking-wider">
                    Timetable Management
                  </span>
                  <span className="text-xs text-[#777080]">&bull; Interval Overlap Guard</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#29232F] tracking-tight">
                  Weekly Master Timetable &amp; Clash Prevention
                </h1>
                <p className="text-xs sm:text-sm text-[#777080] mt-1.5 leading-relaxed">
                  Schedule lectures and laboratory sessions with automatic trigger-enforced room, faculty, section, and lab-group clash detection.
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={exportingCsv}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA] text-[#29232F] hover:bg-[#F0E5F7]/40 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                >
                  {exportingCsv ? <Loader2 className="w-4 h-4 animate-spin text-[#7150B5]" /> : <Download className="w-4 h-4 text-[#7150B5]" />}
                  <span>Export Timetable CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportTimetableModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F0E5F7] border border-[#EAE2EA] text-[#55368F] hover:bg-[#EAE2EA] text-xs font-bold shadow-2xs transition"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#7150B5]" />
                  <span>Import Timetable CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSlot(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7150B5] hover:bg-[#55368F] text-white text-xs font-bold shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Timetable Slot</span>
                </button>
              </div>
            </div>

            {/* Filter Strip & Clash Guard Indicator */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-2xl bg-[#FFFDFB] border border-[#EAE2EA] shadow-xs">
              {/* Section Filter */}
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA]">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-[#777080] tracking-wider">
                    Section Filter
                  </span>
                  <select
                    value={selectedSectionFilter}
                    onChange={(e) => setSelectedSectionFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-[#29232F] outline-none cursor-pointer mt-0.5"
                  >
                    <option value="all">All Sections ({slots.length} Slots)</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={String(sec.id)}>
                        Section {sec.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* View Scope Indicator */}
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA]">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-[#777080] tracking-wider">
                    Scheduling Scope
                  </span>
                  <span className="text-xs font-bold text-[#29232F] mt-0.5">
                    Theory &bull; Labs &bull; Electives
                  </span>
                </div>
                <Layers className="w-4 h-4 text-[#7150B5]" />
              </div>

              {/* Clash Engine Status */}
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#F0E5F7] border border-[#7150B5]/20">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#7150B5]" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-[#55368F] tracking-wider">
                      Clash Guard Status
                    </span>
                    <span className="text-xs font-bold text-[#7150B5]">
                      Active &bull; Trigger Enforced
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-[#7150B5] shadow-2xs">
                  Zero Clashes
                </span>
              </div>
            </div>

            {/* Weekly Timetable Matrix Canvas */}
            <div className="w-full overflow-x-auto rounded-2xl bg-white border border-[#EAE2EA] shadow-xs">
              <div className="min-w-[1080px]">
                {/* Timetable Header Row */}
                <div className="grid grid-cols-7 bg-[#FFF9F7] border-b border-[#EAE2EA] text-xs font-bold text-[#777080]">
                  <div className="p-3.5 border-r border-[#EAE2EA] uppercase tracking-wider text-[#29232F]">
                    Day \ Period
                  </div>
                  {periods.map((p) => (
                    <div key={p} className="p-3 text-center border-r last:border-r-0 border-[#EAE2EA]">
                      <span className="block font-bold text-[#29232F]">Period {p}</span>
                      <span className="text-[10px] font-medium text-[#777080] lowercase">
                        {p === 1
                          ? "09:00 - 10:00"
                          : p === 2
                          ? "10:00 - 11:00"
                          : p === 3
                          ? "11:15 - 12:15"
                          : p === 4
                          ? "12:15 - 13:15"
                          : p === 5
                          ? "14:00 - 15:00"
                          : "15:00 - 16:00"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Days Rows */}
                {days.map((d) => (
                  <div
                    key={d.num}
                    className="grid grid-cols-7 border-b last:border-b-0 border-[#EAE2EA] min-h-[90px] hover:bg-[#FFF9F7]/30 transition-colors"
                  >
                    {/* Day Name Column */}
                    <div className="p-3.5 border-r border-[#EAE2EA] bg-[#FFF9F7]/60 flex flex-col justify-center">
                      <span className="font-bold text-xs text-[#29232F]">{d.name}</span>
                      <span className="text-[10px] text-[#777080]">Day {d.num}</span>
                    </div>

                    {/* Periods 1 to 6 */}
                    {periods.map((p) => {
                      const periodSlots = filteredSlots.filter(
                        (s) => s.day_of_week === d.num && s.period_no === p,
                      );

                      return (
                        <div
                          key={p}
                          className="p-2 border-r last:border-r-0 border-[#EAE2EA] flex flex-col gap-1.5 justify-center relative group"
                        >
                          {periodSlots.length === 0 ? (
                            <span className="text-[11px] text-[#777080]/40 text-center select-none">—</span>
                          ) : (
                            periodSlots.map((s) => (
                              <div
                                key={s.id}
                                className={`p-2 rounded-xl text-left border shadow-2xs relative transition hover:shadow-xs ${
                                  s.lab_group_name
                                    ? "bg-[#FFFDFB] border-amber-200"
                                    : "bg-white border-[#EAE2EA]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-mono font-bold text-xs text-[#7150B5]">
                                    {s.subject_code}
                                  </span>
                                  {s.lab_group_name ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                      {s.lab_group_name}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#F0E5F7] text-[#55368F]">
                                      Sec {s.section_name}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[#29232F] font-semibold truncate mt-0.5">
                                  {s.subject_name}
                                </p>
                                <div className="flex items-center justify-between text-[10px] text-[#777080] mt-1 pt-1 border-t border-[#EAE2EA]/50">
                                  <span className="truncate">{s.faculty_name}</span>
                                  <span className="font-mono font-bold text-[#29232F]">{s.room}</span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteSlot(s.id)}
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-700 rounded transition"
                                  title="Delete slot"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: SUBJECTS CURRICULUM ================= */}
        {activeTab === "subjects" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE2EA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#29232F]">Curriculum &amp; Course Syllabi</h2>
                <p className="text-xs text-[#777080] mt-1">
                  Manage departmental theory subjects, laboratory modules, assessment maximum marks, and elective courses.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSubject(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7150B5] hover:bg-[#55368F] text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-4 h-4" /> Add Subject
              </button>
            </div>

            {/* Subjects Table */}
            <div className="bg-white rounded-2xl border border-[#EAE2EA] shadow-xs overflow-hidden">
              <div className="p-5 border-b border-[#EAE2EA] flex items-center justify-between">
                <h3 className="font-bold text-sm text-[#29232F]">Curriculum Modules</h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F0E5F7] text-[#55368F]">
                  {subjects.length} Subjects Registered
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#EAE2EA] text-xs">
                  <thead className="bg-[#FFF9F7]">
                    <tr>
                      <th className="px-5 py-3 text-left font-bold text-[#777080] uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-5 py-3 text-left font-bold text-[#777080] uppercase tracking-wider">
                        Subject Name
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Semester
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Max IT Marks
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Max Assign Marks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE2EA]/70 bg-white">
                    {subjects.map((sub) => (
                      <tr key={sub.id} className="hover:bg-[#FFF9F7]/70 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-[#7150B5]">{sub.code}</td>
                        <td className="px-5 py-3.5 font-bold text-[#29232F]">{sub.name}</td>
                        <td className="px-4 py-3.5 text-center">
                          {sub.subject_type === "lab" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F3DDD0] text-[#29232F]">
                              Laboratory
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#F0E5F7] text-[#55368F]">
                              Theory
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-[#29232F]">
                          Sem {sub.semester}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {sub.is_elective ? (
                            <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              Elective
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#777080]">Core Subject</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono font-bold text-[#29232F]">
                          {sub.max_it_marks}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono font-bold text-[#29232F]">
                          {sub.max_assignment_marks}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: FACULTY ASSIGNMENTS ================= */}
        {activeTab === "assignments" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE2EA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#29232F]">Faculty Teaching Allocations</h2>
                <p className="text-xs text-[#777080] mt-1">
                  Assign instructors to course sections and laboratory batches for AY 2026-27.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAssign(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7150B5] hover:bg-[#55368F] text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-4 h-4" /> Assign Faculty
              </button>
            </div>

            {/* Assignments Table */}
            <div className="bg-white rounded-2xl border border-[#EAE2EA] shadow-xs overflow-hidden">
              <div className="p-5 border-b border-[#EAE2EA] flex items-center justify-between">
                <h3 className="font-bold text-sm text-[#29232F]">Active Subject Assignments</h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F0E5F7] text-[#55368F]">
                  {assignments.length} Allocations
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#EAE2EA] text-xs">
                  <thead className="bg-[#FFF9F7]">
                    <tr>
                      <th className="px-5 py-3 text-left font-bold text-[#777080] uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="px-5 py-3 text-left font-bold text-[#777080] uppercase tracking-wider">
                        Faculty Instructor
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Section
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Target Allocation
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Subject Type
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE2EA]/70 bg-white">
                    {assignments.map((a) => (
                      <tr key={a.id} className="hover:bg-[#FFF9F7]/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="font-mono font-bold text-[#7150B5] block">{a.subject_code}</span>
                          <span className="font-semibold text-[#29232F]">{a.subject_name}</span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-[#29232F]">
                          {a.faculty_name}
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-[#29232F]">
                          Section {a.section_name}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {a.lab_group_name ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              {a.lab_group_name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#F0E5F7] text-[#55368F]">
                              Entire Section
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center capitalize text-[#777080]">
                          {a.subject_type}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: DEPARTMENTAL CSV IMPORT ================= */}
        {activeTab === "import" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE2EA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#29232F]">Departmental CSV Data Import</h2>
                <p className="text-xs text-[#777080] mt-1">
                  Bulk-import verified student rosters, faculty records, or weekly timetable schedules strictly scoped to Computer Engineering.
                </p>
              </div>

              {/* Entity Type Toggle */}
              <div className="flex items-center gap-1.5 p-1 bg-[#FFF9F7] rounded-xl border border-[#EAE2EA]">
                <button
                  type="button"
                  onClick={() => setImportType("student")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    importType === "student"
                      ? "bg-[#7150B5] text-white shadow-2xs"
                      : "text-[#777080] hover:text-[#29232F]"
                  }`}
                >
                  Import Students
                </button>
                <button
                  type="button"
                  onClick={() => setImportType("faculty")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    importType === "faculty"
                      ? "bg-[#7150B5] text-white shadow-2xs"
                      : "text-[#777080] hover:text-[#29232F]"
                  }`}
                >
                  Import Faculty
                </button>
                <button
                  type="button"
                  onClick={() => setImportType("timetable")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    importType === "timetable"
                      ? "bg-[#7150B5] text-white shadow-2xs"
                      : "text-[#777080] hover:text-[#29232F]"
                  }`}
                >
                  Import Timetable
                </button>
              </div>
            </div>

            {/* Department-Scoped Dynamic CSV Import Wizard */}
            <CsvImportWizard
              key={importType}
              entityType={importType}
              departmentId={user?.departmentId || undefined}
              termId={currentTerm?.id}
              templateUrl={
                importType === "timetable"
                  ? `/api/import/template/timetable?department_id=${user?.departmentId || ""}`
                  : undefined
              }
              templateFilename={
                importType === "timetable"
                  ? "timetable_template.csv"
                  : undefined
              }
              onComplete={() => {
                loadAllData();
                setBannerSuccess(`Successfully imported ${importType} records into department!`);
              }}
            />
          </div>
        )}
      </main>

      {/* ================= ADD TIMETABLE SLOT MODAL ================= */}
      {showAddSlot && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#EAE2EA]">
            <h3 className="text-base font-bold text-[#29232F] mb-1">Add Timetable Slot</h3>
            <p className="text-xs text-[#777080] mb-4">
              Schedule a period with automatic interval clash checking.
            </p>
            <form onSubmit={handleAddSlot} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#777080] uppercase mb-1">
                  Subject Assignment
                </label>
                <select
                  required
                  value={slotForm.subject_assignment_id}
                  onChange={(e) => setSlotForm({ ...slotForm, subject_assignment_id: e.target.value })}
                  className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5] bg-white"
                >
                  <option value="">Select subject assignment</option>
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.subject_code} - {a.subject_name} ({a.faculty_name}) [Sec {a.section_name}
                      {a.lab_group_name ? ` - ${a.lab_group_name}` : ""}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#777080] uppercase mb-1">Day</label>
                  <select
                    value={slotForm.day_of_week}
                    onChange={(e) => setSlotForm({ ...slotForm, day_of_week: e.target.value })}
                    className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5] bg-white"
                  >
                    {days.map((d) => (
                      <option key={d.num} value={d.num}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#777080] uppercase mb-1">Period</label>
                  <select
                    value={slotForm.period_no}
                    onChange={(e) => setSlotForm({ ...slotForm, period_no: e.target.value })}
                    className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5] bg-white"
                  >
                    {periods.map((p) => (
                      <option key={p} value={p}>
                        Period {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#777080] uppercase mb-1">Start</label>
                  <input
                    type="time"
                    required
                    value={slotForm.start_time}
                    onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
                    className="w-full px-2 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#777080] uppercase mb-1">End</label>
                  <input
                    type="time"
                    required
                    value={slotForm.end_time}
                    onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
                    className="w-full px-2 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#777080] uppercase mb-1">Room</label>
                  <input
                    type="text"
                    required
                    value={slotForm.room}
                    onChange={(e) => setSlotForm({ ...slotForm, room: e.target.value })}
                    placeholder="e.g. L101"
                    className="w-full px-2 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSlot(false)}
                  className="px-4 py-2 border border-[#EAE2EA] rounded-xl text-xs font-semibold text-[#777080] hover:bg-[#FFF9F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7150B5] hover:bg-[#55368F] text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Schedule Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADD SUBJECT MODAL ================= */}
      {showAddSubject && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#EAE2EA]">
            <h3 className="text-base font-bold text-[#29232F] mb-1">Add Curriculum Subject</h3>
            <p className="text-xs text-[#777080] mb-4">Define a new course module with assessment criteria.</p>
            <form onSubmit={handleAddSubject} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#777080] uppercase mb-1">Code</label>
                  <input
                    type="text"
                    required
                    value={subjectForm.code}
                    onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                    placeholder="e.g. CS501"
                    className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] font-mono outline-none focus:border-[#7150B5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#777080] uppercase mb-1">Semester</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    required
                    value={subjectForm.semester}
                    onChange={(e) => setSubjectForm({ ...subjectForm, semester: e.target.value })}
                    className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#777080] uppercase mb-1">Subject Name</label>
                <input
                  type="text"
                  required
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  placeholder="e.g. Database Management Systems"
                  className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#777080] uppercase mb-1">Type</label>
                  <select
                    value={subjectForm.subject_type}
                    onChange={(e) => setSubjectForm({ ...subjectForm, subject_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5] bg-white"
                  >
                    <option value="theory">Theory</option>
                    <option value="lab">Laboratory</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <input
                    type="checkbox"
                    id="isElectiveCheckbox"
                    checked={subjectForm.is_elective}
                    onChange={(e) => setSubjectForm({ ...subjectForm, is_elective: e.target.checked })}
                    className="h-4 w-4 rounded border-[#EAE2EA] text-[#7150B5] focus:ring-[#7150B5]/30 cursor-pointer"
                  />
                  <label htmlFor="isElectiveCheckbox" className="ml-2 text-xs font-bold text-[#29232F] cursor-pointer">
                    Is Elective Course
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#777080] uppercase mb-1">Max IT Marks</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={subjectForm.max_it_marks}
                    onChange={(e) => setSubjectForm({ ...subjectForm, max_it_marks: e.target.value })}
                    className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#777080] uppercase mb-1">Max Assign Marks</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={subjectForm.max_assignment_marks}
                    onChange={(e) => setSubjectForm({ ...subjectForm, max_assignment_marks: e.target.value })}
                    className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubject(false)}
                  className="px-4 py-2 border border-[#EAE2EA] rounded-xl text-xs font-semibold text-[#777080] hover:bg-[#FFF9F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7150B5] hover:bg-[#55368F] text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Add Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADD FACULTY ASSIGNMENT MODAL ================= */}
      {showAddAssign && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#EAE2EA]">
            <h3 className="text-base font-bold text-[#29232F] mb-1">Assign Subject to Faculty</h3>
            <p className="text-xs text-[#777080] mb-4">Allocate teaching duties for the active term.</p>
            <form onSubmit={handleAddAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#777080] uppercase mb-1">Subject</label>
                <select
                  required
                  value={assignForm.subject_id}
                  onChange={(e) => setAssignForm({ ...assignForm, subject_id: e.target.value })}
                  className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5] bg-white"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name} ({sub.subject_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#777080] uppercase mb-1">Faculty Member</label>
                <select
                  required
                  value={assignForm.faculty_id}
                  onChange={(e) => setAssignForm({ ...assignForm, faculty_id: e.target.value })}
                  className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5] bg-white"
                >
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.full_name} ({f.employee_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#777080] uppercase mb-1">Class Section</label>
                <select
                  required
                  value={assignForm.section_id}
                  onChange={(e) => {
                    const secId = e.target.value;
                    setAssignForm({ ...assignForm, section_id: secId, lab_group_id: "" });
                    loadSectionLabGroups(secId);
                  }}
                  className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5] bg-white"
                >
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lab Group Allocation */}
              <div>
                <label className="block text-xs font-bold text-[#777080] uppercase mb-1">
                  Lab Group Allocation (Optional)
                </label>
                <select
                  value={assignForm.lab_group_id}
                  onChange={(e) => setAssignForm({ ...assignForm, lab_group_id: e.target.value })}
                  className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5] bg-white"
                >
                  <option value="">Entire Section (All Groups / Theory)</option>
                  {sectionLabGroups.map((lg) => (
                    <option key={lg.id} value={lg.id}>
                      {lg.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAssign(false)}
                  className="px-4 py-2 border border-[#EAE2EA] rounded-xl text-xs font-semibold text-[#777080] hover:bg-[#FFF9F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7150B5] hover:bg-[#55368F] text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Create Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ================= IMPORT TIMETABLE CSV MODAL ================= */}
      {showImportTimetableModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl my-8">
            <CsvImportWizard
              entityType="timetable"
              departmentId={user?.departmentId || undefined}
              termId={currentTerm?.id}
              templateUrl={`/api/import/template/timetable?department_id=${user?.departmentId || ""}`}
              templateFilename="timetable_template.csv"
              onCancel={() => setShowImportTimetableModal(false)}
              onComplete={() => {
                loadAllData();
                setShowImportTimetableModal(false);
                setBannerSuccess("Timetable CSV imported and validated successfully!");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
