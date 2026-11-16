"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { apiFetch, getStoredUser, User } from "@/lib/api";
import {
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Clock,
  FileText,
  Loader2,
  GraduationCap,
  Award,
  Layers,
  Calendar,
  ShieldCheck,
  Printer,
  ChevronRight,
  Info,
  User as UserIcon,
  HelpCircle,
  FileSpreadsheet,
  AlertCircle,
  X,
  ExternalLink,
} from "lucide-react";

interface StudentReport {
  student: {
    id: number;
    roll_no: string;
    full_name: string;
    admission_year: number;
    section_name: string;
    lab_group_name: string | null;
    program_name: string;
    department_name: string;
  };
  subjects: Array<{
    subject_assignment_id: number;
    subject_id: number;
    subject_code: string;
    subject_name: string;
    subject_type: "theory" | "lab";
    is_elective: boolean;
    max_it_marks: number;
    max_assignment_marks: number;
    faculty_name: string;
    total_lectures: number | null;
    present_count: number | null;
    attendance_pct: number | null;
    attendance_threshold: number | null;
    is_eligible: boolean | null;
    it1: number | null;
    it2: number | null;
    it3: number | null;
    assignment: number | null;
  }>;
}

export default function StudentDashboard() {
  const [data, setData] = useState<StudentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "marks" | "attendance">("overview");
  const [courseFilter, setCourseFilter] = useState<"all" | "theory" | "lab" | "shortage">("all");
  const [showCondonationModal, setShowCondonationModal] = useState(false);
  const [storedUser, setStoredUser] = useState<User | null>(null);

  useEffect(() => {
    setStoredUser(getStoredUser());
    loadReport();
  }, []);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<StudentReport>("/api/reports/my-report");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load student academic record");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF9F7] flex flex-col">
        <AppHeader
          activeTab={activeTab}
          onTabChange={(k) => setActiveTab(k as any)}
          termText="AY 2024-25 • Even Semester (Active)"
          statusBadge="Student Portal"
          navItems={[
            { key: "overview", label: "Overview & Progress", icon: GraduationCap },
            { key: "marks", label: "Internal Marks", icon: Award },
            { key: "attendance", label: "Attendance & Clearance", icon: Clock },
          ]}
        />
        <div className="flex-1 flex flex-col items-center justify-center py-32 text-[#777080]">
          <Loader2 className="w-9 h-9 animate-spin text-[#7150B5] mb-3" />
          <p className="text-sm font-medium text-[#29232F]">Loading your academic records...</p>
          <p className="text-xs text-[#777080] mt-1">Connecting to university records database</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FFF9F7] flex flex-col">
        <AppHeader
          activeTab={activeTab}
          onTabChange={(k) => setActiveTab(k as any)}
          termText="AY 2024-25 • Even Semester (Active)"
          statusBadge="Student Portal"
          navItems={[
            { key: "overview", label: "Overview & Progress", icon: GraduationCap },
            { key: "marks", label: "Internal Marks", icon: Award },
            { key: "attendance", label: "Attendance & Clearance", icon: Clock },
          ]}
        />
        <div className="max-w-4xl mx-auto px-4 py-16 w-full">
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-red-900">Academic Records Unavailable</h3>
                <p className="text-xs text-red-700 mt-0.5">{error || "Could not retrieve your student report."}</p>
              </div>
            </div>
            <button
              onClick={loadReport}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors shrink-0"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { student, subjects } = data;

  // Initials for avatar monogram
  const initials = student.full_name
    ? student.full_name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join("")
    : "ST";

  // Calculations
  const validAttendance = subjects.filter((s) => s.attendance_pct !== null && s.attendance_pct !== undefined);
  const totalLectures = subjects.reduce((acc, s) => acc + (s.total_lectures || 0), 0);
  const totalAttended = subjects.reduce((acc, s) => acc + (s.present_count || 0), 0);

  const avgAttendance =
    totalLectures > 0
      ? ((totalAttended / totalLectures) * 100).toFixed(1)
      : validAttendance.length > 0
      ? (validAttendance.reduce((acc, s) => acc + Number(s.attendance_pct), 0) / validAttendance.length).toFixed(1)
      : "0.0";

  const numAvgAttendance = parseFloat(avgAttendance) || 0;
  const defaultThreshold = subjects[0]?.attendance_threshold ? Number(subjects[0].attendance_threshold) : 75;

  // Shortage courses
  const shortageSubjects = subjects.filter((s) => {
    const t = s.attendance_threshold ? Number(s.attendance_threshold) : defaultThreshold;
    if (s.is_eligible === false) return true;
    if (s.attendance_pct !== null && s.attendance_pct !== undefined) {
      return Number(s.attendance_pct) < t;
    }
    return false;
  });

  const allEligible = shortageSubjects.length === 0;

  // CIE Marks calculation
  let totalCieEarned = 0;
  let totalCiePossible = 0;
  let enteredComponents = 0;

  subjects.forEach((s) => {
    if (s.it1 !== null) {
      totalCieEarned += Number(s.it1);
      totalCiePossible += Number(s.max_it_marks);
      enteredComponents++;
    }
    if (s.it2 !== null) {
      totalCieEarned += Number(s.it2);
      totalCiePossible += Number(s.max_it_marks);
      enteredComponents++;
    }
    if (s.it3 !== null) {
      totalCieEarned += Number(s.it3);
      totalCiePossible += Number(s.max_it_marks);
      enteredComponents++;
    }
    if (s.assignment !== null) {
      totalCieEarned += Number(s.assignment);
      totalCiePossible += Number(s.max_assignment_marks);
      enteredComponents++;
    }
  });

  const ciePercentage = totalCiePossible > 0 ? ((totalCieEarned / totalCiePossible) * 100).toFixed(1) : null;

  // Counts for filter pills
  const theoryCount = subjects.filter((s) => s.subject_type === "theory").length;
  const labCount = subjects.filter((s) => s.subject_type === "lab").length;
  const shortageCount = shortageSubjects.length;

  const filteredSubjects = subjects.filter((s) => {
    if (courseFilter === "theory") return s.subject_type === "theory";
    if (courseFilter === "lab") return s.subject_type === "lab";
    if (courseFilter === "shortage") {
      const t = s.attendance_threshold ? Number(s.attendance_threshold) : defaultThreshold;
      return s.is_eligible === false || (s.attendance_pct !== null && Number(s.attendance_pct) < t);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#FFF9F7] text-[#29232F] flex flex-col font-sans">
      {/* 2-tier Horizontal Application Header */}
      <AppHeader
        activeTab={activeTab}
        onTabChange={(k) => setActiveTab(k as any)}
        termText="AY 2024-25 • Even Semester (Active)"
        statusBadge="Student Portal"
        navItems={[
          { key: "overview", label: "Overview & Progress", icon: GraduationCap },
          { key: "marks", label: "Internal Marks", icon: Award },
          { key: "attendance", label: "Attendance & Clearance", icon: Clock },
        ]}
      />

      <main className="w-full flex-1 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Breadcrumb Context */}
        <div className="flex items-center justify-between text-xs text-[#777080] mb-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#7150B5]">
              <GraduationCap className="w-4 h-4" /> Student Portal
            </span>
            <span>/</span>
            <span className="text-[#29232F] font-semibold">
              {activeTab === "overview"
                ? "Academic Progress & Enrolled Courses"
                : activeTab === "marks"
                ? "Continuous Internal Evaluation (CIE)"
                : "Attendance Breakdown & Statutory Standing"}
            </span>
            <span>/</span>
            <span className="px-2 py-0.5 rounded-md bg-[#F0E5F7] text-[#55368F] font-semibold text-[11px]">
              {student.roll_no}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-medium text-[#777080]">Academic Records Synced</span>
          </div>
        </div>

        {/* Ambient Decorative Student Standing Identity Banner */}
        <div className="relative w-full overflow-hidden rounded-2xl bg-[#FFFDFB] border border-[#EAE2EA] p-6 lg:p-8 shadow-xs mb-8">
          {/* Subtle Decorative Ambient Scrims */}
          <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-[#F0E5F7]/40 blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-72 h-72 rounded-full bg-[#F3DDD0]/50 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-6">
            {/* Top Identity Profile Line */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="flex items-start sm:items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-[#F3DDD0] text-[#55368F] flex items-center justify-center font-headline text-xl font-bold shadow-inner">
                    {initials}
                  </div>
                  <div
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-xs"
                    title="Active Registered Student"
                  >
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  </div>
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-[#29232F] tracking-tight">{student.full_name}</h1>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#F0E5F7] text-[#55368F] font-mono text-xs font-bold border border-[#EAE2EA]">
                      Roll No: {student.roll_no}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FFF9F7] text-[#777080] font-medium text-xs border border-[#EAE2EA]">
                      Section {student.section_name}
                      {student.lab_group_name ? ` • Lab ${student.lab_group_name}` : ""}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#777080] mt-1 font-medium">
                    {student.program_name} &bull; {student.department_name} &bull; Admitted {student.admission_year}
                  </p>
                </div>
              </div>

              {/* Academic Progress Pill & Quick Actions */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFF9F7] border border-[#EAE2EA] text-[#777080] text-xs font-medium">
                  <Calendar className="w-3.5 h-3.5 text-[#7150B5]" />
                  <span>
                    AY 2024-25 Even Semester &bull;{" "}
                    <strong className="text-[#29232F] font-semibold">{subjects.length} Courses Enrolled</strong>
                  </span>
                </div>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#EAE2EA] hover:bg-[#FFF9F7] text-[#29232F] text-xs font-semibold shadow-2xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-[#7150B5]" />
                  <span>Print Grade Slip</span>
                </button>
              </div>
            </div>

            {/* 3 Key Decision / Metric Answer Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Metric 1: Statutory Attendance */}
              <div className="rounded-xl bg-white border border-[#EAE2EA] p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden group hover:border-[#7150B5]/40 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#777080]">
                      Statutory Attendance
                    </span>
                    {allEligible ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E5F7EE] text-[#1E7D58] text-xs font-bold border border-[#A7E5C8]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#279B78]"></span>
                        Safe Standing
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFF4E5] text-[#B25E00] text-xs font-bold border border-[#FED7AA]">
                        <AlertTriangle className="w-3 h-3 text-[#B25E00]" />
                        Attendance Shortage
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2.5 mb-2">
                    <span className="text-3xl font-extrabold text-[#29232F] tracking-tight">{avgAttendance}%</span>
                    <span className="text-xs text-[#777080] font-medium">
                      Across {subjects.length} registered courses
                    </span>
                  </div>
                  <div className="w-full bg-[#F0E5F7]/60 rounded-full h-2 mb-3 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        numAvgAttendance >= defaultThreshold
                          ? "bg-[#279B78]"
                          : numAvgAttendance >= 65
                          ? "bg-[#E68A00]"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(numAvgAttendance, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-[#777080] pt-2 border-t border-[#EAE2EA]/50">
                  <span>Statutory Req: {defaultThreshold}.0%</span>
                  {allEligible ? (
                    <span className="text-[#1E7D58] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Exam Eligible
                    </span>
                  ) : (
                    <span className="text-[#B25E00] font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Shortage Flagged
                    </span>
                  )}
                </div>
              </div>

              {/* Metric 2: Examination Clearance */}
              <div className="rounded-xl bg-white border border-[#EAE2EA] p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden group hover:border-[#7150B5]/40 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#777080]">
                      Semester Exam Clearance
                    </span>
                    {allEligible ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F0E5F7] text-[#55368F] text-xs font-bold border border-[#D5C3E8]">
                        Clearance Granted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-200">
                        Clearance At Risk
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col mb-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        className={`w-5 h-5 ${allEligible ? "text-[#7150B5]" : "text-amber-600"}`}
                      />
                      <span className="text-lg font-bold text-[#29232F]">
                        {allEligible ? "Unrestricted Access" : "Conditionally Restricted"}
                      </span>
                    </div>
                    <p className="text-xs text-[#777080] mt-1.5 line-clamp-2">
                      {allEligible
                        ? "End-Term examination hall ticket criteria satisfied across all registered modules."
                        : `Attendance shortage detected in ${shortageSubjects.length} course(s). Requires faculty & HOD clearance.`}
                    </p>
                  </div>
                </div>
                <div className="pt-2 flex items-center justify-between text-xs border-t border-[#EAE2EA]/50 text-[#777080]">
                  <span>Candidate Token: <strong className="font-mono text-[#29232F]">#{student.roll_no}</strong></span>
                  <button
                    onClick={() => setActiveTab("attendance")}
                    className="text-[#7150B5] hover:text-[#55368F] font-bold inline-flex items-center gap-0.5"
                  >
                    View Clearance &rarr;
                  </button>
                </div>
              </div>

              {/* Metric 3: Internal Performance (CIE) */}
              <div className="rounded-xl bg-white border border-[#EAE2EA] p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden group hover:border-[#7150B5]/40 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#777080]">
                      Internal Performance
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F3DDD0] text-[#55368F] text-xs font-bold border border-[#E8CABA]">
                      CIE Benchmark
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2.5 mb-2">
                    <span className="text-3xl font-extrabold text-[#29232F] tracking-tight">
                      {ciePercentage !== null ? `${ciePercentage}%` : "Evaluating"}
                    </span>
                    <span className="text-xs text-[#7150B5] font-semibold">
                      {totalCiePossible > 0 ? `${totalCieEarned} / ${totalCiePossible} Marks` : "Assessments In Progress"}
                    </span>
                  </div>
                  <p className="text-xs text-[#777080] mb-2 line-clamp-2">
                    Continuous Internal Evaluation benchmark across theory test cycles and laboratory practicals.
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-[#777080] pt-2 border-t border-[#EAE2EA]/50">
                  <span>Evaluations Recorded: <strong className="text-[#29232F]">{enteredComponents} components</strong></span>
                  <button
                    onClick={() => setActiveTab("marks")}
                    className="text-[#7150B5] hover:text-[#55368F] font-bold"
                  >
                    Grade Details &rarr;
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TAB 1: OVERVIEW & ENROLLED COURSES */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#7150B5]"></span>
                  <h2 className="text-lg font-bold text-[#29232F]">Registered Courses & Academic Standing</h2>
                </div>
                <p className="text-xs text-[#777080] mt-0.5">
                  Detailed real-time metrics for {subjects.length} enrolled subjects in Semester • AY 2024-25
                </p>
              </div>

              {/* Quick Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#F0E5F7]/50 border border-[#EAE2EA] self-start sm:self-auto">
                <button
                  onClick={() => setCourseFilter("all")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    courseFilter === "all"
                      ? "bg-white text-[#7150B5] shadow-2xs border border-[#EAE2EA]"
                      : "text-[#777080] hover:text-[#29232F]"
                  }`}
                >
                  All ({subjects.length})
                </button>
                <button
                  onClick={() => setCourseFilter("theory")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    courseFilter === "theory"
                      ? "bg-white text-[#7150B5] shadow-2xs border border-[#EAE2EA]"
                      : "text-[#777080] hover:text-[#29232F]"
                  }`}
                >
                  Theory ({theoryCount})
                </button>
                <button
                  onClick={() => setCourseFilter("lab")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    courseFilter === "lab"
                      ? "bg-white text-[#7150B5] shadow-2xs border border-[#EAE2EA]"
                      : "text-[#777080] hover:text-[#29232F]"
                  }`}
                >
                  Laboratory ({labCount})
                </button>
                {shortageCount > 0 && (
                  <button
                    onClick={() => setCourseFilter("shortage")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      courseFilter === "shortage"
                        ? "bg-amber-100 text-amber-900 shadow-2xs border border-amber-300"
                        : "text-amber-700 hover:text-amber-900"
                    }`}
                  >
                    Shortage ({shortageCount})
                  </button>
                )}
              </div>
            </div>

            {/* Courses Bento Grid (2 Columns on Desktop) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredSubjects.map((subj) => {
                const pct =
                  subj.attendance_pct !== null && subj.attendance_pct !== undefined
                    ? Number(subj.attendance_pct)
                    : null;
                const threshold = subj.attendance_threshold ? Number(subj.attendance_threshold) : defaultThreshold;
                const isEligible = subj.is_eligible ?? (pct !== null && pct >= threshold);

                // Margin calculations
                const held = subj.total_lectures || 0;
                const present = subj.present_count || 0;

                let marginText = "";
                let marginColor = "text-[#1E7D58]";

                if (held > 0 && pct !== null) {
                  if (pct >= threshold) {
                    const safeToMiss = Math.floor((present - (threshold / 100) * held) / (threshold / 100));
                    marginText = safeToMiss > 0 ? `+${safeToMiss} Classes Safe Margin` : "On Statutory Threshold";
                  } else {
                    const needed = Math.ceil(((threshold / 100) * held - present) / (1 - threshold / 100));
                    marginText = `-${needed > 0 ? needed : 1} Class Shortage Deficit`;
                    marginColor = "text-[#B25E00]";
                  }
                } else {
                  marginText = "Initial schedule";
                }

                // Progress Bar styling
                let barColor = "bg-[#279B78]";
                if (pct !== null) {
                  if (pct < 65) barColor = "bg-red-500";
                  else if (pct < threshold) barColor = "bg-[#E68A00]";
                }

                return (
                  <div
                    key={subj.subject_assignment_id}
                    className="flex flex-col justify-between rounded-2xl bg-white border border-[#EAE2EA] p-6 shadow-xs hover:shadow-md transition-all group"
                  >
                    <div>
                      {/* Course Header */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-md bg-[#F0E5F7] text-[#55368F] font-mono text-xs font-bold border border-[#EAE2EA]">
                              {subj.subject_code}
                            </span>
                            <span className="text-xs text-[#777080] font-medium capitalize">
                              {subj.subject_type === "lab" ? "Practical / Lab" : "Theory Course"}
                            </span>
                            {subj.is_elective && (
                              <span className="px-2 py-0.5 rounded-md bg-[#F3DDD0] text-[#55368F] text-[11px] font-semibold border border-[#E8CABA]">
                                Elective
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-[#29232F] truncate">{subj.subject_name}</h3>
                          <span className="text-xs text-[#777080] mt-0.5 flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-[#7150B5]" />
                            Faculty: {subj.faculty_name}
                          </span>
                        </div>

                        {/* Eligibility Status Pill */}
                        <div className="shrink-0">
                          {isEligible ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E5F7EE] text-[#1E7D58] text-xs font-bold border border-[#A7E5C8]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Eligible
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFF4E5] text-[#B25E00] text-xs font-bold border border-[#FED7AA]">
                              <AlertTriangle className="w-3.5 h-3.5" /> Below {threshold}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Attendance Meter */}
                      <div className="rounded-xl bg-[#FFF9F7] border border-[#EAE2EA] p-4 mb-4">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-[#777080] font-medium flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#7150B5]" /> Attendance Record
                          </span>
                          <span className="font-bold text-[#29232F]">
                            {subj.present_count ?? 0} / {subj.total_lectures ?? 0} Sessions{" "}
                            <span className={pct !== null && pct >= threshold ? "text-[#1E7D58]" : "text-[#B25E00]"}>
                              ({pct !== null ? `${pct}%` : "No sessions held"})
                            </span>
                          </span>
                        </div>
                        <div className="w-full bg-[#F0E5F7]/80 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${barColor}`}
                            style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-2.5 text-[11px] text-[#777080]">
                          <span>Threshold: {threshold}% ({Math.ceil((threshold / 100) * (subj.total_lectures || 0))} sessions)</span>
                          <span className={`font-semibold ${marginColor}`}>{marginText}</span>
                        </div>
                      </div>
                    </div>

                    {/* Internal Marks Breakdown */}
                    <div className="mt-2 pt-3 border-t border-[#EAE2EA]">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#777080] flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-[#7150B5]" /> Continuous Assessment
                        </span>
                        <span className="text-xs font-semibold text-[#7150B5]">
                          IT Max: {subj.max_it_marks} | Assign: {subj.max_assignment_marks}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="p-2.5 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA] flex flex-col">
                          <span className="text-[11px] font-semibold text-[#777080]">IT 1</span>
                          <span className="text-sm font-bold text-[#29232F] mt-0.5">
                            {subj.it1 !== null ? subj.it1 : <span className="text-gray-300 font-normal italic">Pending</span>}
                          </span>
                          <span className="text-[10px] text-[#777080]">/{subj.max_it_marks}</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA] flex flex-col">
                          <span className="text-[11px] font-semibold text-[#777080]">IT 2</span>
                          <span className="text-sm font-bold text-[#29232F] mt-0.5">
                            {subj.it2 !== null ? subj.it2 : <span className="text-gray-300 font-normal italic">Pending</span>}
                          </span>
                          <span className="text-[10px] text-[#777080]">/{subj.max_it_marks}</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA] flex flex-col">
                          <span className="text-[11px] font-semibold text-[#777080]">IT 3</span>
                          <span className="text-sm font-bold text-[#29232F] mt-0.5">
                            {subj.it3 !== null ? subj.it3 : <span className="text-gray-300 font-normal italic">Pending</span>}
                          </span>
                          <span className="text-[10px] text-[#777080]">/{subj.max_it_marks}</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA] flex flex-col">
                          <span className="text-[11px] font-semibold text-[#777080]">Assign.</span>
                          <span className="text-sm font-bold text-[#29232F] mt-0.5">
                            {subj.assignment !== null ? subj.assignment : <span className="text-gray-300 font-normal italic">Pending</span>}
                          </span>
                          <span className="text-[10px] text-[#777080]">/{subj.max_assignment_marks}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Support & Advisory Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
              {/* Card 1: Examination Advisory */}
              <div className="rounded-2xl bg-white border border-[#EAE2EA] p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-[#7150B5]" />
                      <h3 className="text-sm font-bold text-[#29232F]">Hall Ticket Eligibility</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#F0E5F7] text-[#55368F] text-[11px] font-semibold">
                      COE Verified
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA] mb-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#777080]">Candidate Reg No.</span>
                      <span className="font-mono font-semibold text-[#29232F]">{student.roll_no}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#777080]">Academic Program</span>
                      <span className="font-semibold text-[#29232F]">{student.program_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#777080]">Eligible Modules</span>
                      <span className="font-semibold text-[#1E7D58]">
                        {subjects.length - shortageCount} of {subjects.length} Cleared
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[#777080] leading-relaxed">
                    {allEligible
                      ? "All courses satisfy university statutory regulations. Your end-semester hall ticket is cleared for generation."
                      : "Attendance deficit in one or more subjects may prevent issuance of end-term hall ticket without approved condonation."}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-[#EAE2EA]">
                  <button
                    onClick={() => setShowCondonationModal(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#F0E5F7] hover:bg-[#EAE2EA] text-[#55368F] text-xs font-semibold transition-colors"
                  >
                    <Info className="w-4 h-4 text-[#7150B5]" />
                    <span>Condonation Guidelines</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Academic Department & Section */}
              <div className="rounded-2xl bg-white border border-[#EAE2EA] p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-[#7150B5]" />
                      <h3 className="text-sm font-bold text-[#29232F]">Curriculum Cohort</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#F3DDD0] text-[#55368F] text-[11px] font-semibold">
                      Department
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA] mb-3 text-xs space-y-2">
                    <div>
                      <p className="text-[11px] text-[#777080]">Department</p>
                      <p className="font-semibold text-[#29232F]">{student.department_name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <p className="text-[11px] text-[#777080]">Assigned Section</p>
                        <p className="font-semibold text-[#29232F]">Section {student.section_name}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#777080]">Lab Group</p>
                        <p className="font-semibold text-[#29232F]">
                          {student.lab_group_name ? `Group ${student.lab_group_name}` : "General"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[#777080] leading-relaxed">
                    Subject assignments, timetable schedules, and laboratory allocations are managed by your Department Head.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-[#EAE2EA]">
                  <button
                    onClick={() => setActiveTab("marks")}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#EAE2EA] hover:bg-[#FFF9F7] text-[#29232F] text-xs font-semibold transition-colors"
                  >
                    <span>View All Internal Marks</span>
                    <ChevronRight className="w-4 h-4 text-[#777080]" />
                  </button>
                </div>
              </div>

              {/* Card 3: Quick Action & Self-Service Utility */}
              <div className="rounded-2xl bg-white border border-[#EAE2EA] p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-[#7150B5]" />
                      <h3 className="text-sm font-bold text-[#29232F]">Student Self-Service</h3>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#E5F7EE] text-[#1E7D58] text-[11px] font-semibold">
                      Online
                    </span>
                  </div>
                  <p className="text-xs text-[#777080] mb-4 leading-relaxed">
                    Official academic records are updated in real-time by your subject faculty after each session and internal test.
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={() => window.print()}
                      className="w-full inline-flex items-center justify-between p-3 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA] hover:border-[#7150B5]/40 text-xs font-semibold text-[#29232F] transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <Printer className="w-4 h-4 text-[#7150B5]" /> Download Semester Grade Slip (.pdf)
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#777080]" />
                    </button>
                    <button
                      onClick={() => setActiveTab("attendance")}
                      className="w-full inline-flex items-center justify-between p-3 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA] hover:border-[#7150B5]/40 text-xs font-semibold text-[#29232F] transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#7150B5]" /> Full Attendance Clearance Audit
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#777080]" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-[#EAE2EA] text-[11px] text-[#777080] text-center">
                  University Academic ERP &bull; AcadTrack
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INTERNAL MARKS BREAKDOWN */}
        {activeTab === "marks" && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-white border border-[#EAE2EA] rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#29232F] flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#7150B5]" /> Continuous Internal Evaluation (CIE) Marks
                </h2>
                <p className="text-xs text-[#777080] mt-1">
                  Full assessment record across Internal Tests (IT1, IT2, IT3) and Coursework Assignments
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-[#FFF9F7] border border-[#EAE2EA] px-3.5 py-2 rounded-xl text-right">
                  <p className="text-[10px] text-[#777080] font-semibold uppercase">Total CIE Aggregate</p>
                  <p className="text-lg font-bold text-[#7150B5]">
                    {totalCieEarned} <span className="text-xs text-[#777080] font-normal">/ {totalCiePossible}</span>
                  </p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#7150B5] hover:bg-[#55368F] text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Marks</span>
                </button>
              </div>
            </div>

            {/* Marks Table */}
            <div className="bg-white border border-[#EAE2EA] rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FFF9F7] border-b border-[#EAE2EA] text-[#777080] uppercase tracking-wider font-semibold text-[11px]">
                      <th className="py-3.5 px-4">Subject</th>
                      <th className="py-3.5 px-3">Type</th>
                      <th className="py-3.5 px-3">Faculty</th>
                      <th className="py-3.5 px-3 text-center">IT 1</th>
                      <th className="py-3.5 px-3 text-center">IT 2</th>
                      <th className="py-3.5 px-3 text-center">IT 3</th>
                      <th className="py-3.5 px-3 text-center">Assignment</th>
                      <th className="py-3.5 px-4 text-right">Course Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE2EA]">
                    {subjects.map((subj) => {
                      const totalEarned =
                        (subj.it1 || 0) + (subj.it2 || 0) + (subj.it3 || 0) + (subj.assignment || 0);
                      const totalMax = subj.max_it_marks * 3 + subj.max_assignment_marks;
                      const hasAnyMarks =
                        subj.it1 !== null || subj.it2 !== null || subj.it3 !== null || subj.assignment !== null;

                      return (
                        <tr key={subj.subject_assignment_id} className="hover:bg-[#FFF9F7]/70 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#55368F] bg-[#F0E5F7] px-2 py-0.5 rounded border border-[#EAE2EA]">
                                {subj.subject_code}
                              </span>
                              <span className="font-bold text-[#29232F]">{subj.subject_name}</span>
                            </div>
                          </td>
                          <td className="py-4 px-3">
                            <span className="capitalize px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF9F7] text-[#777080] border border-[#EAE2EA]">
                              {subj.subject_type}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-[#777080]">{subj.faculty_name}</td>
                          <td className="py-4 px-3 text-center">
                            {subj.it1 !== null ? (
                              <span className="font-bold text-[#29232F]">
                                {subj.it1} <span className="text-[#777080] font-normal text-[10px]">/{subj.max_it_marks}</span>
                              </span>
                            ) : (
                              <span className="text-gray-300 italic">Pending</span>
                            )}
                          </td>
                          <td className="py-4 px-3 text-center">
                            {subj.it2 !== null ? (
                              <span className="font-bold text-[#29232F]">
                                {subj.it2} <span className="text-[#777080] font-normal text-[10px]">/{subj.max_it_marks}</span>
                              </span>
                            ) : (
                              <span className="text-gray-300 italic">Pending</span>
                            )}
                          </td>
                          <td className="py-4 px-3 text-center">
                            {subj.it3 !== null ? (
                              <span className="font-bold text-[#29232F]">
                                {subj.it3} <span className="text-[#777080] font-normal text-[10px]">/{subj.max_it_marks}</span>
                              </span>
                            ) : (
                              <span className="text-gray-300 italic">Pending</span>
                            )}
                          </td>
                          <td className="py-4 px-3 text-center">
                            {subj.assignment !== null ? (
                              <span className="font-bold text-[#29232F]">
                                {subj.assignment}{" "}
                                <span className="text-[#777080] font-normal text-[10px]">/{subj.max_assignment_marks}</span>
                              </span>
                            ) : (
                              <span className="text-gray-300 italic">Pending</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {hasAnyMarks ? (
                              <span className="font-bold text-[#7150B5]">
                                {totalEarned}{" "}
                                <span className="text-[#777080] font-normal text-[10px]">/ {totalMax}</span>
                              </span>
                            ) : (
                              <span className="text-gray-300 italic">Not Entered</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Assessment Regulations Note */}
            <div className="bg-[#FFF9F7] border border-[#EAE2EA] rounded-2xl p-5 flex items-start gap-3 text-xs text-[#777080]">
              <Info className="w-5 h-5 text-[#7150B5] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#29232F]">Continuous Assessment Regulations</p>
                <p className="mt-1 leading-relaxed">
                  Internal tests (IT1, IT2, IT3) and Assignments are evaluated as per institutional academic council guidelines.
                  For queries regarding missing or disputed marks, please contact your respective course faculty member.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ATTENDANCE BREAKDOWN & CLEARANCE */}
        {activeTab === "attendance" && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-white border border-[#EAE2EA] rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#29232F] flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#7150B5]" /> Attendance Audit & Statutory Examination Standing
                </h2>
                <p className="text-xs text-[#777080] mt-1">
                  University attendance requirement: {defaultThreshold}% mandatory attendance in each course for final exam clearance.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                    allEligible
                      ? "bg-[#E5F7EE] text-[#1E7D58] border border-[#A7E5C8]"
                      : "bg-[#FFF4E5] text-[#B25E00] border border-[#FED7AA]"
                  }`}
                >
                  {allEligible ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> All Subjects Cleared
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4" /> {shortageCount} Subject Shortage
                    </>
                  )}
                </span>
                <button
                  onClick={() => setShowCondonationModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#F0E5F7] text-[#55368F] text-xs font-semibold hover:bg-[#EAE2EA] transition-colors"
                >
                  Leave / Condonation
                </button>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-white border border-[#EAE2EA] rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FFF9F7] border-b border-[#EAE2EA] text-[#777080] uppercase tracking-wider font-semibold text-[11px]">
                      <th className="py-3.5 px-4">Subject</th>
                      <th className="py-3.5 px-3">Type</th>
                      <th className="py-3.5 px-3">Faculty</th>
                      <th className="py-3.5 px-3 text-center">Sessions Held</th>
                      <th className="py-3.5 px-3 text-center">Sessions Attended</th>
                      <th className="py-3.5 px-4 text-center">Attendance %</th>
                      <th className="py-3.5 px-3 text-center">Threshold</th>
                      <th className="py-3.5 px-4 text-right">Clearance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE2EA]">
                    {subjects.map((subj) => {
                      const pct =
                        subj.attendance_pct !== null && subj.attendance_pct !== undefined
                          ? Number(subj.attendance_pct)
                          : null;
                      const threshold = subj.attendance_threshold ? Number(subj.attendance_threshold) : defaultThreshold;
                      const isEligible = subj.is_eligible ?? (pct !== null && pct >= threshold);

                      return (
                        <tr key={subj.subject_assignment_id} className="hover:bg-[#FFF9F7]/70 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-[#55368F] bg-[#F0E5F7] px-2 py-0.5 rounded border border-[#EAE2EA]">
                                {subj.subject_code}
                              </span>
                              <span className="font-bold text-[#29232F]">{subj.subject_name}</span>
                            </div>
                          </td>
                          <td className="py-4 px-3">
                            <span className="capitalize px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF9F7] text-[#777080] border border-[#EAE2EA]">
                              {subj.subject_type}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-[#777080]">{subj.faculty_name}</td>
                          <td className="py-4 px-3 text-center font-semibold text-[#29232F]">
                            {subj.total_lectures ?? 0}
                          </td>
                          <td className="py-4 px-3 text-center font-semibold text-[#29232F]">
                            {subj.present_count ?? 0}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex flex-col items-center">
                              <span
                                className={`font-extrabold text-sm ${
                                  pct !== null && pct >= threshold
                                    ? "text-[#1E7D58]"
                                    : pct !== null
                                    ? "text-[#B25E00]"
                                    : "text-gray-400"
                                }`}
                              >
                                {pct !== null ? `${pct}%` : "N/A"}
                              </span>
                              <div className="w-16 bg-[#F0E5F7] rounded-full h-1.5 mt-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    pct !== null && pct >= threshold ? "bg-[#279B78]" : "bg-[#E68A00]"
                                  }`}
                                  style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-3 text-center font-medium text-[#777080]">{threshold}%</td>
                          <td className="py-4 px-4 text-right">
                            {isEligible ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E5F7EE] text-[#1E7D58] font-bold text-xs border border-[#A7E5C8]">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Eligible
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFF4E5] text-[#B25E00] font-bold text-xs border border-[#FED7AA]">
                                <AlertTriangle className="w-3.5 h-3.5" /> Shortage
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attendance Rules Accordion / Guide */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-[#FFFDFB] border border-[#EAE2EA]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#7150B5] mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Examination Eligibility Criteria
                </h4>
                <p className="text-xs text-[#777080] leading-relaxed">
                  Students must secure minimum {defaultThreshold}% attendance in every registered theory and laboratory subject.
                  Students falling between 65% - 74.9% due to medical or approved university duties may apply for condonation.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[#FFFDFB] border border-[#EAE2EA]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#7150B5] mb-2 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Attendance Freeze & Review
                </h4>
                <p className="text-xs text-[#777080] leading-relaxed">
                  Attendance is locked and submitted directly by subject faculty after each class slot. Discrepancies must be
                  reported to the course instructor within 48 hours of session recording.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Condonation & Leave Guidelines Modal */}
      {showCondonationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-[#EAE2EA] flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE2EA]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F0E5F7] text-[#55368F] flex items-center justify-center">
                  <Info className="w-5 h-5 text-[#7150B5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#29232F]">Attendance Condonation Guidelines</h3>
                  <p className="text-[11px] text-[#777080]">Dean of Academic Affairs Official Regulations</p>
                </div>
              </div>
              <button
                onClick={() => setShowCondonationModal(false)}
                className="p-1 rounded-lg text-[#777080] hover:bg-[#FFF9F7] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-[#777080] space-y-3 leading-relaxed">
              <p>
                Under university statutory regulations, candidates with aggregate attendance below {defaultThreshold}%
                may seek condonation on grounds of:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-1 text-[#29232F]">
                <li>Medical hospitalisation or medical leave with authorized medical officer certificate.</li>
                <li>Participation in inter-university cultural, sports, or NCC / NSS authorized events.</li>
                <li>University-sanctioned research project visits or conferences.</li>
              </ul>
              <div className="p-3 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA] text-[#29232F]">
                <p className="font-semibold text-[#55368F] mb-1">Condonation Threshold Limit:</p>
                <p className="text-[11px] text-[#777080]">
                  Condonation cannot be granted if attendance is below 65% under any circumstances as mandated by the Academic Council.
                </p>
              </div>
              <p className="text-[11px]">
                Submit the original documentation along with a signed recommendation from your Department Head to the Office of the Controller of Examinations within 5 working days.
              </p>
            </div>

            <div className="pt-3 border-t border-[#EAE2EA] flex justify-end">
              <button
                onClick={() => setShowCondonationModal(false)}
                className="px-4 py-2 bg-[#7150B5] hover:bg-[#55368F] text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
