"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { apiFetch } from "@/lib/api";
import {
  Building2,
  Calendar,
  Settings,
  BarChart3,
  Users,
  Plus,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  Check,
  TrendingUp,
  Download,
  Filter,
  RefreshCw,
} from "lucide-react";
import CsvImportWizard from "@/components/CsvImportWizard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

export default function CollegeAdminDashboard() {
  const [activeTab, setActiveTab] = useState<"analytics" | "institution" | "terms" | "settings" | "import">("analytics");
  const [importType, setImportType] = useState<"student" | "faculty">("student");

  // Analytics state
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [facultyList, setFacultyList] = useState<any[]>([]);

  // Institution state
  const [departments, setDepartments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [labGroups, setLabGroups] = useState<any[]>([]);
  const [showAddDept, setShowAddDept] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: "", code: "" });

  // Terms state
  const [terms, setTerms] = useState<any[]>([]);
  const [showAddTerm, setShowAddTerm] = useState(false);
  const [termForm, setTermForm] = useState({
    academic_year: "2026-2027",
    term_type: "even" as "odd" | "even",
    start_date: "2026-12-15",
    end_date: "2027-04-30",
    is_current: false,
  });

  // Settings state
  const [threshold, setThreshold] = useState("75");
  const [savingSettings, setSavingSettings] = useState(false);

  // Banner
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoadingAnalytics(true);
    try {
      const [anRes, dRes, pRes, bRes, sRes, lgRes, tRes, setRes, fRes] = await Promise.all([
        apiFetch<any[]>("/api/reports/analytics"),
        apiFetch<any[]>("/api/institution/departments"),
        apiFetch<any[]>("/api/institution/programs"),
        apiFetch<any[]>("/api/institution/batches"),
        apiFetch<any[]>("/api/institution/sections"),
        apiFetch<any[]>("/api/institution/lab-groups"),
        apiFetch<any[]>("/api/institution/academic-terms"),
        apiFetch<any>("/api/institution/settings"),
        apiFetch<any[]>("/api/academic/faculty").catch(() => []),
      ]);

      setAnalytics(anRes);
      setDepartments(dRes);
      setPrograms(pRes);
      setBatches(bRes);
      setSections(sRes);
      setLabGroups(lgRes);
      setTerms(tRes);
      if (setRes?.attendance_threshold) {
        setThreshold(String(setRes.attendance_threshold));
      }
      if (fRes) {
        setFacultyList(fRes);
      }
    } catch {} finally {
      setLoadingAnalytics(false);
    }
  }

  async function handleAddDept(e: React.FormEvent) {
    e.preventDefault();
    setBannerSuccess(null);
    setBannerError(null);
    try {
      await apiFetch("/api/institution/departments", {
        method: "POST",
        body: JSON.stringify(deptForm),
      });
      setBannerSuccess(`Department ${deptForm.name} created!`);
      setShowAddDept(false);
      setDeptForm({ name: "", code: "" });
      const dRes = await apiFetch<any[]>("/api/institution/departments");
      setDepartments(dRes);
    } catch (err: any) {
      setBannerError(err.message || "Failed to create department");
    }
  }

  async function handleAddTerm(e: React.FormEvent) {
    e.preventDefault();
    setBannerSuccess(null);
    setBannerError(null);
    try {
      await apiFetch("/api/institution/academic-terms", {
        method: "POST",
        body: JSON.stringify(termForm),
      });
      setBannerSuccess("Academic term added successfully!");
      setShowAddTerm(false);
      const tRes = await apiFetch<any[]>("/api/institution/academic-terms");
      setTerms(tRes);
    } catch (err: any) {
      setBannerError(err.message || "Failed to create academic term");
    }
  }

  async function handleSetCurrentTerm(termId: number) {
    setBannerSuccess(null);
    setBannerError(null);
    try {
      await apiFetch(`/api/institution/academic-terms/${termId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_current: true }),
      });
      setBannerSuccess("Current term updated!");
      const tRes = await apiFetch<any[]>("/api/institution/academic-terms");
      setTerms(tRes);
    } catch (err: any) {
      setBannerError(err.message || "Failed to set current term");
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setBannerSuccess(null);
    setBannerError(null);
    try {
      await apiFetch("/api/institution/settings", {
        method: "PUT",
        body: JSON.stringify({ attendance_threshold: Number(threshold) }),
      });
      setBannerSuccess(`Attendance eligibility threshold updated to ${threshold}%!`);
    } catch (err: any) {
      setBannerError(err.message || "Failed to update settings");
    } finally {
      setSavingSettings(false);
    }
  }

  const currentTerm = terms.find((t) => t.is_current);
  const termDisplay = currentTerm
    ? `AY ${currentTerm.academic_year} • ${currentTerm.term_type === "even" ? "Even" : "Odd"} Semester (Active)`
    : "AY 2026-27 • Active Term";

  const totalStudents = analytics.reduce((acc, d) => acc + Number(d.total_students || 0), 0);
  const totalFaculty =
    facultyList.length > 0
      ? facultyList.length
      : analytics.reduce((acc, d) => acc + Number(d.total_faculty || 0), 0);
  const totalShortage = analytics.reduce(
    (acc, d) => acc + Number(d.below_threshold_count ?? d.below_threshold_students ?? 0),
    0,
  );
  const reportingDeptsWithAtt = analytics.filter(
    (d) => Number(d.total_students || 0) > 0 && Number(d.average_attendance_pct ?? d.avg_attendance_pct ?? 0) > 0,
  );
  const collegeAvgAttendance =
    reportingDeptsWithAtt.length > 0
      ? (
          reportingDeptsWithAtt.reduce(
            (acc, d) => acc + Number(d.average_attendance_pct ?? d.avg_attendance_pct ?? 0),
            0,
          ) / reportingDeptsWithAtt.length
        ).toFixed(1)
      : analytics.length > 0
        ? (
            analytics.reduce(
              (acc, d) => acc + Number(d.average_attendance_pct ?? d.avg_attendance_pct ?? 0),
              0,
            ) / analytics.length
          ).toFixed(1)
        : "0.0";

  return (
    <div className="min-h-screen bg-[#FFF9F7] flex flex-col font-sans selection:bg-[#F0E5F7] selection:text-[#55368F]">
      {/* ================= SHARED APPLICATION HEADER & HORIZONTAL NAV ================= */}
      <AppHeader
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab as any);
          if (tab === "analytics") {
            loadAll();
          }
        }}
        termText={termDisplay}
        statusBadge="8 Department Nodes Synced"
        navItems={[
          { key: "analytics", label: "College Analytics", icon: BarChart3 },
          { key: "institution", label: "Hierarchy & Structure", icon: Building2 },
          { key: "terms", label: "Academic Terms", icon: Calendar },
          { key: "settings", label: "Threshold Settings", icon: Settings },
          { key: "import", label: "CSV Data Import", icon: FileSpreadsheet },
        ]}
      />

      <main className="w-full flex-1 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Breadcrumb Context */}
        <div className="flex items-center justify-between text-xs text-[#777080] mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#7150B5]">
              <Building2 className="w-4 h-4" /> University Governance
            </span>
            <span>/</span>
            <span className="text-[#29232F] font-semibold">Institutional Management</span>
            <span>/</span>
            <span className="px-2 py-0.5 rounded-md bg-[#F0E5F7] text-[#55368F] font-semibold text-[11px]">
              College Administration Console
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-medium text-[#777080]">Real-time Academic Database</span>
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

        {/* ================= TAB 1: COLLEGE ANALYTICS ================= */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            {/* Executive Header Banner */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE2EA] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#F3DDD0] text-[#29232F] font-semibold text-[11px] uppercase tracking-wider">
                    Executive Governance
                  </span>
                  <span className="text-xs text-[#777080]">&bull; Institutional Performance Metric</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#29232F] tracking-tight">
                  College Academic Analytics
                </h1>
                <p className="text-xs sm:text-sm text-[#777080] mt-1.5 leading-relaxed">
                  Comprehensive attendance metrics, threshold compliance, and departmental performance overview for {termDisplay}.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => loadAll()}
                  disabled={loadingAnalytics}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA] text-[#29232F] hover:bg-[#F0E5F7]/40 text-xs font-semibold transition disabled:opacity-50"
                  title="Force immediate synchronization with database"
                >
                  <RefreshCw className={`w-4 h-4 text-[#7150B5] ${loadingAnalytics ? "animate-spin" : ""}`} />
                  <span>{loadingAnalytics ? "Syncing..." : "Sync / Refresh Analytics"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("settings")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFF9F7] border border-[#EAE2EA] text-[#29232F] hover:bg-[#F0E5F7]/40 text-xs font-semibold transition"
                >
                  <Settings className="w-4 h-4 text-[#7150B5]" />
                  <span>Threshold Settings ({threshold}%)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("import")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7150B5] hover:bg-[#55368F] text-white text-xs font-bold shadow-xs transition"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Bulk CSV Import</span>
                </button>
              </div>
            </div>

            {/* KPI Summary Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Total Departments */}
              <div className="bg-white rounded-2xl p-5 border border-[#EAE2EA] shadow-xs flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#777080] block">
                      Total Departments
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-extrabold text-[#29232F]">{departments.length}</span>
                      <span className="text-xs font-semibold text-[#7150B5]">Active Nodes</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#F0E5F7] flex items-center justify-center text-[#7150B5]">
                    <Building2 className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#EAE2EA]/60 flex items-center justify-between text-[11px] text-[#777080]">
                  <span>Faculty Staff:</span>
                  <span className="font-semibold text-[#29232F]">{totalFaculty} Appointed</span>
                </div>
              </div>

              {/* KPI 2: Total Students */}
              <div className="bg-white rounded-2xl p-5 border border-[#EAE2EA] shadow-xs flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#777080] block">
                      Total Enrolled Students
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-extrabold text-[#29232F]">{totalStudents}</span>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Active Roster
                      </span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#F3DDD0] flex items-center justify-center text-[#695C53]">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#EAE2EA]/60 flex items-center justify-between text-[11px] text-[#777080]">
                  <span>Class Sections:</span>
                  <span className="font-semibold text-[#29232F]">{sections.length} Active</span>
                </div>
              </div>

              {/* KPI 3: College Attendance Average */}
              <div className="bg-white rounded-2xl p-5 border border-[#EAE2EA] shadow-xs flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#777080] block">
                      College Avg Attendance
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-extrabold text-[#7150B5]">{collegeAvgAttendance}%</span>
                      <span className="text-xs font-semibold text-[#777080]">Cross-dept</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#F0E5F7] flex items-center justify-center text-[#7150B5]">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#EAE2EA]/60 flex items-center justify-between text-[11px] text-[#777080]">
                  <span>Compliance Baseline:</span>
                  <span className="font-semibold text-[#29232F]">&ge; {threshold}% Statutory</span>
                </div>
              </div>

              {/* KPI 4: Shortage Students */}
              <div className="bg-white rounded-2xl p-5 border border-[#EAE2EA] shadow-xs flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#777080] block">
                      Students Below Threshold
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-extrabold text-[#D96F79]">{totalShortage}</span>
                      <span className="text-xs font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                        &lt; {threshold}%
                      </span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-[#D96F79]">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#EAE2EA]/60 flex items-center justify-between text-[11px] text-[#777080]">
                  <span>Action Status:</span>
                  <span className="font-semibold text-red-700">Notice Pending</span>
                </div>
              </div>
            </div>

            {/* Department Comparison Chart */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE2EA] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h3 className="text-base font-bold text-[#29232F]">
                    Departmental Performance Comparison
                  </h3>
                  <p className="text-xs text-[#777080] mt-0.5">
                    Average student attendance percentage vs. below-threshold student count by department
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-[#29232F]">
                    <span className="w-3 h-3 rounded bg-[#7150B5]"></span>
                    <span>Avg Attendance %</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium text-[#29232F]">
                    <span className="w-3 h-3 rounded bg-[#F3DDD0]"></span>
                    <span>Shortage Students</span>
                  </div>
                </div>
              </div>

              <div className="h-72 w-full">
                {loadingAnalytics ? (
                  <div className="h-full flex items-center justify-center text-xs text-[#777080] gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#7150B5]" />
                    <span>Loading analytics data...</span>
                  </div>
                ) : analytics.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-[#777080]">
                    No departmental analytics records available yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.map((d) => ({
                        name: d.department_code || d.department_name,
                        attendance: Number(d.average_attendance_pct || 0),
                        shortage: Number(d.below_threshold_count || 0),
                      }))}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#777080" }} axisLine={{ stroke: "#EAE2EA" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#777080" }} axisLine={{ stroke: "#EAE2EA" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFDFB",
                          borderColor: "#EAE2EA",
                          borderRadius: "0.75rem",
                          boxShadow: "0 4px 16px -2px rgba(41,35,47,0.08)",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="attendance" fill="#7150B5" radius={[4, 4, 0, 0]} name="Avg Attendance %" />
                      <Bar dataKey="shortage" fill="#F3DDD0" radius={[4, 4, 0, 0]} name="Below Threshold" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Department Breakdown Table */}
            <div className="bg-white rounded-2xl border border-[#EAE2EA] shadow-xs overflow-hidden">
              <div className="p-5 border-b border-[#EAE2EA] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#29232F]">Departmental Breakdown &amp; Compliance</h3>
                  <p className="text-xs text-[#777080] mt-0.5">Status based on {threshold}% threshold policy</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#F0E5F7] text-[#55368F]">
                  {analytics.length} Departments Reporting
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#EAE2EA] text-xs">
                  <thead className="bg-[#FFF9F7]">
                    <tr>
                      <th className="px-5 py-3 text-left font-bold text-[#777080] uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Active Students
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Faculty
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Avg Attendance
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Shortage (&lt;{threshold}%)
                      </th>
                      <th className="px-5 py-3 text-right font-bold text-[#777080] uppercase tracking-wider">
                        Compliance Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE2EA]/70 bg-white">
                    {analytics.map((dept) => {
                      const avg = Number(dept.average_attendance_pct ?? dept.avg_attendance_pct ?? 0);
                      const studentCount = Number(dept.total_students || 0);
                      const shortageCount = Number(dept.below_threshold_count ?? dept.below_threshold_students ?? 0);
                      const facultyCount = Number(dept.total_faculty || 0);
                      const hasData = studentCount > 0 && (avg > 0 || shortageCount > 0);

                      let statusBadge;
                      if (!hasData) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            No Data
                          </span>
                        );
                      } else if (avg >= Number(threshold)) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3" /> Compliant
                          </span>
                        );
                      } else if (avg >= Number(threshold) - 10) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" /> Warning
                          </span>
                        );
                      } else {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-800 border border-red-200">
                            <AlertTriangle className="w-3 h-3" /> Critical
                          </span>
                        );
                      }

                      return (
                        <tr key={dept.department_id} className="hover:bg-[#FFF9F7]/70 transition-colors">
                          <td className="px-5 py-3.5 font-semibold text-[#29232F]">
                            {dept.department_name}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono font-bold text-[#7150B5]">
                            {dept.department_code}
                          </td>
                          <td className="px-4 py-3.5 text-center font-medium text-[#29232F]">
                            {studentCount}
                          </td>
                          <td className="px-4 py-3.5 text-center font-medium text-[#29232F]">
                            {facultyCount}
                          </td>
                          <td className="px-4 py-3.5 text-center font-semibold text-[#29232F]">
                            <div className="inline-flex items-center gap-2">
                              <span>{hasData ? `${avg}%` : "0.0%"}</span>
                              <div className="w-16 h-1.5 rounded-full bg-[#EAE2EA] overflow-hidden hidden sm:block">
                                <div
                                  className={`h-full rounded-full ${
                                    !hasData
                                      ? "bg-gray-300"
                                      : avg >= Number(threshold)
                                        ? "bg-[#7150B5]"
                                        : "bg-[#D96F79]"
                                  }`}
                                  style={{ width: `${Math.min(avg, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`font-bold px-2 py-0.5 rounded-md ${
                                shortageCount > 0 ? "text-[#D96F79] bg-red-50" : "text-[#777080] bg-gray-50"
                              }`}
                            >
                              {shortageCount}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {statusBadge}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: HIERARCHY & STRUCTURE ================= */}
        {activeTab === "institution" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE2EA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#29232F]">Academic Hierarchy &amp; Structure</h2>
                <p className="text-xs text-[#777080] mt-1">
                  Manage college academic departments, programs, student batches, sections, and lab divisions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDept(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7150B5] hover:bg-[#55368F] text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-4 h-4" /> Add Department
              </button>
            </div>

            {/* Department Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {departments.map((dept) => {
                const deptPrograms = programs.filter((p) => p.department_id === dept.id);
                return (
                  <div
                    key={dept.id}
                    className="bg-white rounded-2xl p-5 border border-[#EAE2EA] shadow-xs flex flex-col justify-between hover:border-[#7150B5]/40 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-xs font-bold text-[#7150B5] bg-[#F0E5F7] px-2 py-0.5 rounded-md">
                          {dept.code}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Active Node
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-[#29232F]">{dept.name}</h3>

                      <div className="mt-3 space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#777080] block">
                          Degree Programs ({deptPrograms.length})
                        </span>
                        {deptPrograms.length === 0 ? (
                          <p className="text-xs text-[#777080] italic">No programs configured</p>
                        ) : (
                          <div className="space-y-1">
                            {deptPrograms.map((prog) => (
                              <div
                                key={prog.id}
                                className="px-2.5 py-1.5 rounded-lg bg-[#FFF9F7] text-xs font-medium text-[#29232F] flex items-center justify-between"
                              >
                                <span>{prog.name}</span>
                                <span className="text-[10px] uppercase font-bold text-[#777080] bg-[#F3DDD0] px-1.5 py-0.2 rounded">
                                  {prog.level}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#EAE2EA] flex items-center justify-between text-[11px] text-[#777080]">
                      <span>Batches Linked: {batches.length}</span>
                      <span>Sections: {sections.length}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 3: ACADEMIC TERMS ================= */}
        {activeTab === "terms" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE2EA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#29232F]">Academic Terms &amp; Semesters</h2>
                <p className="text-xs text-[#777080] mt-1">
                  Configure academic sessions, statutory term dates, and active semester flags.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTerm(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7150B5] hover:bg-[#55368F] text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-4 h-4" /> Add Academic Term
              </button>
            </div>

            {/* Terms Table */}
            <div className="bg-white rounded-2xl border border-[#EAE2EA] shadow-xs overflow-hidden">
              <div className="p-5 border-b border-[#EAE2EA] flex items-center justify-between">
                <h3 className="font-bold text-sm text-[#29232F]">Registered Academic Terms</h3>
                <span className="text-xs text-[#777080] font-medium">Only one term can be active at a time</span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[#EAE2EA] text-xs">
                  <thead className="bg-[#FFF9F7]">
                    <tr>
                      <th className="px-5 py-3 text-left font-bold text-[#777080] uppercase tracking-wider">
                        Academic Year
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Term Type
                      </th>
                      <th className="px-4 py-3 text-left font-bold text-[#777080] uppercase tracking-wider">
                        Start Date
                      </th>
                      <th className="px-4 py-3 text-left font-bold text-[#777080] uppercase tracking-wider">
                        End Date
                      </th>
                      <th className="px-4 py-3 text-center font-bold text-[#777080] uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-5 py-3 text-right font-bold text-[#777080] uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE2EA]/70 bg-white">
                    {terms.map((t) => (
                      <tr key={t.id} className="hover:bg-[#FFF9F7]/70 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-[#29232F]">{t.academic_year}</td>
                        <td className="px-4 py-3.5 text-center font-semibold capitalize text-[#7150B5]">
                          {t.term_type} Semester
                        </td>
                        <td className="px-4 py-3.5 text-[#777080] font-medium">
                          {t.start_date ? new Date(t.start_date).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-4 py-3.5 text-[#777080] font-medium">
                          {t.end_date ? new Date(t.end_date).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {t.is_current ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F3DDD0] text-[#29232F]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#7150B5] animate-pulse"></span>
                              Active Term
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-[#777080]">Concluded / Inactive</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {!t.is_current && (
                            <button
                              onClick={() => handleSetCurrentTerm(t.id)}
                              className="px-3 py-1 rounded-lg border border-[#EAE2EA] bg-white hover:bg-[#F0E5F7] text-[#7150B5] font-semibold text-xs transition"
                            >
                              Set as Current
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: THRESHOLD SETTINGS ================= */}
        {activeTab === "settings" && (
          <div className="space-y-6 max-w-4xl">
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE2EA] shadow-xs">
              <div className="max-w-xl">
                <span className="px-2.5 py-0.5 rounded-full bg-[#F0E5F7] text-[#55368F] font-semibold text-[11px] uppercase tracking-wider inline-block mb-2">
                  Institutional Policy Control
                </span>
                <h2 className="text-xl font-bold text-[#29232F]">Statutory Attendance Threshold</h2>
                <p className="text-xs text-[#777080] mt-1 leading-relaxed">
                  Defines the minimum attendance percentage required for a student to be eligible for end-semester university examinations. Changes take effect dynamically across all student and faculty views.
                </p>
              </div>

              <form onSubmit={handleSaveSettings} className="mt-8 space-y-6">
                <div className="p-6 rounded-2xl bg-[#FFF9F7] border border-[#EAE2EA]">
                  <div className="flex items-center justify-between mb-4">
                    <label htmlFor="thresholdInput" className="font-bold text-sm text-[#29232F]">
                      Eligibility Threshold Percentage
                    </label>
                    <span className="text-2xl font-extrabold text-[#7150B5] font-mono">{threshold}%</span>
                  </div>

                  <input
                    id="thresholdSlider"
                    type="range"
                    min="50"
                    max="90"
                    step="5"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    className="w-full accent-[#7150B5] cursor-pointer"
                  />

                  <div className="flex justify-between text-[11px] text-[#777080] font-semibold mt-2">
                    <span>50% (Permissive)</span>
                    <span>75% (UGC Standard)</span>
                    <span>85% (Strict)</span>
                  </div>
                </div>

                {/* Real-time Dynamic Impact Preview */}
                <div className="p-5 rounded-2xl bg-white border border-[#EAE2EA] shadow-2xs space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#777080]">
                    Real-Time Impact Simulation
                  </h4>
                  <p className="text-xs text-[#29232F]">
                    At <strong>{threshold}%</strong> threshold, approximately{" "}
                    <strong className="text-[#D96F79]">{totalShortage} students</strong> across {departments.length}{" "}
                    departments will be flagged with exam eligibility shortages.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-6 py-2.5 bg-[#7150B5] hover:bg-[#55368F] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2"
                  >
                    {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Save &amp; Apply Threshold Policy</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= TAB 5: CSV DATA IMPORT ================= */}
        {activeTab === "import" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EAE2EA] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#29232F]">College-Wide CSV Data Import</h2>
                <p className="text-xs text-[#777080] mt-1">
                  Bulk-import verified student rosters and faculty registrations across departments with automated column mapping.
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
              </div>
            </div>

            {/* Unified Dynamic CSV Import Wizard */}
            <CsvImportWizard
              entityType={importType}
              departments={departments}
              onComplete={() => {
                loadAll();
                setBannerSuccess(`Successfully imported ${importType} records!`);
              }}
            />
          </div>
        )}
      </main>

      {/* ================= ADD DEPARTMENT MODAL ================= */}
      {showAddDept && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#EAE2EA]">
            <h3 className="text-base font-bold text-[#29232F] mb-1">Add Academic Department</h3>
            <p className="text-xs text-[#777080] mb-4">Create a new organizational department node.</p>
            <form onSubmit={handleAddDept} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#777080] uppercase mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="e.g. Mechanical Engineering"
                  className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#777080] uppercase mb-1">
                  Department Code
                </label>
                <input
                  type="text"
                  required
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                  placeholder="e.g. ME"
                  className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] font-mono outline-none focus:border-[#7150B5]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDept(false)}
                  className="px-4 py-2 border border-[#EAE2EA] rounded-xl text-xs font-semibold text-[#777080] hover:bg-[#FFF9F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7150B5] hover:bg-[#55368F] text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADD TERM MODAL ================= */}
      {showAddTerm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#EAE2EA]">
            <h3 className="text-base font-bold text-[#29232F] mb-1">Add Academic Term</h3>
            <p className="text-xs text-[#777080] mb-4">Define a new academic year and semester timeline.</p>
            <form onSubmit={handleAddTerm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#777080] uppercase mb-1">
                  Academic Year
                </label>
                <input
                  type="text"
                  required
                  value={termForm.academic_year}
                  onChange={(e) => setTermForm({ ...termForm, academic_year: e.target.value })}
                  placeholder="e.g. 2026-2027"
                  className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#777080] uppercase mb-1">
                  Term Type
                </label>
                <select
                  value={termForm.term_type}
                  onChange={(e) => setTermForm({ ...termForm, term_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5] bg-white"
                >
                  <option value="even">Even Semester</option>
                  <option value="odd">Odd Semester</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#777080] uppercase mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={termForm.start_date}
                    onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#777080] uppercase mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={termForm.end_date}
                    onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-[#EAE2EA] rounded-xl text-xs text-[#29232F] outline-none focus:border-[#7150B5]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTerm(false)}
                  className="px-4 py-2 border border-[#EAE2EA] rounded-xl text-xs font-semibold text-[#777080] hover:bg-[#FFF9F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7150B5] hover:bg-[#55368F] text-white rounded-xl text-xs font-bold shadow-xs"
                >
                  Add Term
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
