"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
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
  Check,
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
  Legend,
} from "recharts";

export default function CollegeAdminDashboard() {
  const [activeTab, setActiveTab] = useState<"analytics" | "institution" | "terms" | "settings" | "import">("analytics");
  const [importType, setImportType] = useState<"student" | "faculty">("student");

  // Analytics state
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

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
      const [anRes, dRes, pRes, bRes, sRes, lgRes, tRes, setRes] = await Promise.all([
        apiFetch<any[]>("/api/reports/analytics"),
        apiFetch<any[]>("/api/institution/departments"),
        apiFetch<any[]>("/api/institution/programs"),
        apiFetch<any[]>("/api/institution/batches"),
        apiFetch<any[]>("/api/institution/sections"),
        apiFetch<any[]>("/api/institution/lab-groups"),
        apiFetch<any[]>("/api/institution/academic-terms"),
        apiFetch<any>("/api/institution/settings"),
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
    } catch {}
    finally {
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

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">College Administration</h1>
            <p className="text-xs text-gray-500 mt-1">
              Demo College of Engineering (DCE) &bull; Institutional Governance & Overall Performance
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "institution" && (
              <button
                onClick={() => setShowAddDept(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" /> Add Department
              </button>
            )}

            {activeTab === "terms" && (
              <button
                onClick={() => setShowAddTerm(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" /> Add Term
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6 gap-2">
          <button
            onClick={() => setActiveTab("analytics")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === "analytics"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <BarChart3 className="w-4 h-4" /> College Analytics
          </button>

          <button
            onClick={() => setActiveTab("institution")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === "institution"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Building2 className="w-4 h-4" /> Hierarchy & Structure
          </button>

          <button
            onClick={() => setActiveTab("terms")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === "terms"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Calendar className="w-4 h-4" /> Academic Terms
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === "settings"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Settings className="w-4 h-4" /> Threshold Settings
          </button>

          <button
            onClick={() => setActiveTab("import")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === "import"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> CSV Data Import
          </button>
        </div>

        {/* Notifications */}
        {bannerSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2 font-medium">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            {bannerSuccess}
          </div>
        )}

        {bannerError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2 font-medium">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            {bannerError}
          </div>
        )}

        {/* ==================== TAB 1: ANALYTICS ==================== */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Departments</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-2">{departments.length}</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Enrolled Students</p>
                <p className="text-3xl font-extrabold text-indigo-600 mt-2">
                  {analytics.reduce((acc, a) => acc + Number(a.total_students || 0), 0)}
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Active Terms</p>
                <p className="text-3xl font-extrabold text-emerald-600 mt-2">
                  {terms.filter((t) => t.is_current).length}
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Attendance Threshold</p>
                <p className="text-3xl font-extrabold text-purple-600 mt-2">{threshold}%</p>
              </div>
            </div>

            {/* Department Comparison Chart */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
              <h2 className="text-base font-bold text-gray-900 mb-4">Department Attendance & Eligibility Overview</h2>
              {loadingAnalytics ? (
                <div className="py-20 text-center text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                  Loading analytics...
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.map((a) => ({
                        department: a.department_code,
                        avgAttendance: Number(a.avg_attendance_pct || 0),
                        eligible: Number(a.eligible_students || 0),
                        shortage: Number(a.below_threshold_students || 0),
                      }))}
                      margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                      <XAxis dataKey="department" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="avgAttendance" name="Avg Attendance %" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="eligible" name="Eligible Students" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="shortage" name="Shortage Students" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Department Details Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">Department Performance Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Department</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Total Students</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Active Allocations</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Avg Attendance</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Eligible</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Shortage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {analytics.map((a) => (
                      <tr key={a.department_id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-3 font-semibold text-gray-900">
                          {a.department_name} ({a.department_code})
                        </td>
                        <td className="px-6 py-3 text-center font-medium text-gray-700">{a.total_students}</td>
                        <td className="px-6 py-3 text-center font-medium text-gray-700">{a.total_subject_assignments}</td>
                        <td className="px-6 py-3 text-center font-bold text-indigo-600">{a.avg_attendance_pct ?? "N/A"}%</td>
                        <td className="px-6 py-3 text-center font-semibold text-emerald-600">{a.eligible_students}</td>
                        <td className="px-6 py-3 text-center font-semibold text-red-600">{a.below_threshold_students}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: INSTITUTION HIERARCHY ==================== */}
        {activeTab === "institution" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Departments */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
              <h3 className="font-bold text-gray-900 text-sm mb-3">Departments ({departments.length})</h3>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {departments.map((d) => (
                  <div key={d.id} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm text-gray-900">{d.name}</span>
                      <span className="text-xs text-gray-500 block">Code: {d.code}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Programs */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
              <h3 className="font-bold text-gray-900 text-sm mb-3">Degree Programs ({programs.length})</h3>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {programs.map((p) => (
                  <div key={p.id} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm text-gray-900">{p.name}</span>
                      <span className="text-xs text-gray-500 block">
                        {p.level} &bull; {p.duration_years} Years
                      </span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Batches & Sections */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
              <h3 className="font-bold text-gray-900 text-sm mb-3">Batches ({batches.length})</h3>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {batches.map((b) => (
                  <div key={b.id} className="p-3 flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-900">
                      Batch {b.start_year} - {b.end_year}
                    </span>
                    <span className="text-xs text-gray-500">{b.program_name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sections & Lab Groups */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
              <h3 className="font-bold text-gray-900 text-sm mb-3">Sections & Lab Groups</h3>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {sections.map((s) => (
                  <div key={s.id} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm text-gray-900">Section {s.name}</span>
                      <span className="text-xs text-gray-500 block">
                        Lab Groups: {labGroups.filter((lg) => lg.section_id === s.id).map((lg) => lg.name).join(", ") || "None"}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 font-mono">
                      Batch {s.start_year}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: ACADEMIC TERMS ==================== */}
        {activeTab === "terms" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Academic Terms</h2>
              <p className="text-xs text-gray-500">Only one academic term per college can be designated as the active current term.</p>
            </div>

            <div className="divide-y divide-gray-100">
              {terms.map((t) => (
                <div key={t.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-gray-900">{t.academic_year}</span>
                      <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        {t.term_type} Term
                      </span>
                      {t.is_current && (
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Current Active Term
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Duration: {t.start_date} to {t.end_date}
                    </p>
                  </div>

                  {!t.is_current && (
                    <button
                      onClick={() => handleSetCurrentTerm(t.id)}
                      className="px-3.5 py-1.5 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-bold transition shadow-2xs"
                    >
                      Set as Current
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== TAB 4: SETTINGS ==================== */}
        {activeTab === "settings" && (
          <div className="max-w-xl bg-white rounded-2xl border border-gray-200 shadow-xs p-6 sm:p-8">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Attendance Policy Configuration</h2>
            <p className="text-xs text-gray-500 mb-6">
              Configure the minimum percentage threshold required for exam eligibility across the college.
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Attendance Eligibility Threshold (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <span className="absolute right-3 top-2 text-sm text-gray-400 font-bold">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Default: 75.00%. Students with attendance below this percentage are marked ineligible in SQL views.
                </p>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-xs transition flex items-center gap-2"
              >
                {savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Policy
              </button>
            </form>
          </div>
        )}

        {/* ==================== TAB 5: CSV DATA IMPORT ==================== */}
        {activeTab === "import" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-200 shadow-2xs max-w-md">
              <button
                onClick={() => setImportType("student")}
                className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs transition ${
                  importType === "student"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Import Students
              </button>
              <button
                onClick={() => setImportType("faculty")}
                className={`flex-1 py-2 px-4 rounded-lg font-bold text-xs transition ${
                  importType === "faculty"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Import Faculty
              </button>
            </div>

            <CsvImportWizard
              entityType={importType}
              departments={departments}
              onComplete={loadAll}
            />
          </div>
        )}

        {/* Modal: Add Department */}
        {showAddDept && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Add Department</h3>
              <form onSubmit={handleAddDept} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Department Name</label>
                  <input
                    type="text"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    required
                    placeholder="Mechanical Engineering"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Department Code</label>
                  <input
                    type="text"
                    value={deptForm.code}
                    onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                    required
                    placeholder="ME"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 uppercase"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddDept(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-xs"
                  >
                    Create Department
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Term */}
        {showAddTerm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Add Academic Term</h3>
              <form onSubmit={handleAddTerm} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Academic Year</label>
                    <input
                      type="text"
                      value={termForm.academic_year}
                      onChange={(e) => setTermForm({ ...termForm, academic_year: e.target.value })}
                      required
                      placeholder="2026-2027"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Term Type</label>
                    <select
                      value={termForm.term_type}
                      onChange={(e) => setTermForm({ ...termForm, term_type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                    >
                      <option value="odd">Odd</option>
                      <option value="even">Even</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Start Date</label>
                    <input
                      type="date"
                      value={termForm.start_date}
                      onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">End Date</label>
                    <input
                      type="date"
                      value={termForm.end_date}
                      onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddTerm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-xs"
                  >
                    Create Term
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
