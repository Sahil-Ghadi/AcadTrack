"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { apiFetch } from "@/lib/api";
import { CheckCircle2, AlertTriangle, BookOpen, Clock, FileText, Loader2, Sparkles } from "lucide-react";

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

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<StudentReport>("/api/reports/my-report");
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load student report");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-32 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
          <p className="text-sm">Loading your academic record...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between">
            <p className="text-sm font-medium">{error || "Failed to load"}</p>
            <button
              onClick={loadReport}
              className="px-3 py-1 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { student, subjects } = data;

  // Calculate overall attendance
  const validAttendance = subjects.filter((s) => s.attendance_pct !== null && s.attendance_pct !== undefined);
  const avgAttendance =
    validAttendance.length > 0
      ? (validAttendance.reduce((acc, s) => acc + Number(s.attendance_pct), 0) / validAttendance.length).toFixed(1)
      : "N/A";

  const allEligible = subjects.every((s) => s.is_eligible !== false);

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{student.full_name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {student.roll_no}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {student.department_name} &bull; {student.program_name} &bull; Section {student.section_name}
                {student.lab_group_name && ` (Lab ${student.lab_group_name})`}
              </p>
            </div>

            {/* Quick stats pills */}
            <div className="flex items-center gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center min-w-[100px]">
                <p className="text-xs text-gray-500 uppercase font-semibold">Average Attendance</p>
                <p className={`text-xl font-bold ${Number(avgAttendance) >= 75 ? "text-emerald-600" : "text-amber-600"}`}>
                  {avgAttendance}%
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center min-w-[120px]">
                <p className="text-xs text-gray-500 uppercase font-semibold">Exam Eligibility</p>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  {allEligible ? (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" /> Eligible
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-red-600">
                      <AlertTriangle className="w-4 h-4" /> Shortage
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Subjects Grid */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Enrolled Subjects & Academic Standing
          </h2>
          <span className="text-xs font-medium text-gray-500">{subjects.length} Subjects</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {subjects.map((subj) => {
            const pct = subj.attendance_pct !== null && subj.attendance_pct !== undefined ? Number(subj.attendance_pct) : null;
            const threshold = subj.attendance_threshold ? Number(subj.attendance_threshold) : 75;
            const isEligible = subj.is_eligible ?? (pct !== null && pct >= threshold);

            let progressColor = "bg-emerald-500";
            if (pct !== null) {
              if (pct < 65) progressColor = "bg-red-500";
              else if (pct < threshold) progressColor = "bg-amber-500";
            }

            return (
              <div
                key={subj.subject_assignment_id}
                className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col justify-between"
              >
                {/* Header */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {subj.subject_code}
                        </span>
                        {subj.is_elective && (
                          <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                            Elective
                          </span>
                        )}
                        <span className="text-xs text-gray-400 capitalize">{subj.subject_type}</span>
                      </div>
                      <h3 className="text-base font-bold text-gray-900 mt-1">{subj.subject_name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Faculty: {subj.faculty_name}</p>
                    </div>

                    {/* Eligibility Badge */}
                    <div>
                      {isEligible ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Eligible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                          <AlertTriangle className="w-3.5 h-3.5" /> Below {threshold}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Attendance Bar */}
                  <div className="mt-5">
                    <div className="flex justify-between items-baseline text-xs mb-1.5">
                      <span className="font-semibold text-gray-700 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" /> Attendance: {subj.present_count ?? 0} / {subj.total_lectures ?? 0} lectures held
                      </span>
                      <span className="font-bold text-sm text-gray-900">
                        {pct !== null ? `${pct}%` : "No lectures held"}
                      </span>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${progressColor}`}
                        style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Marks Section */}
                <div className="p-6 bg-gray-50/50">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-gray-400" /> Internal Marks
                  </p>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                      <span className="text-[11px] font-semibold text-gray-500 block">IT 1</span>
                      <span className="text-sm font-bold text-gray-900 block mt-0.5">
                        {subj.it1 !== null ? `${subj.it1}` : <span className="text-gray-300 font-normal italic">Pending</span>}
                      </span>
                      <span className="text-[10px] text-gray-400 block">/{subj.max_it_marks}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                      <span className="text-[11px] font-semibold text-gray-500 block">IT 2</span>
                      <span className="text-sm font-bold text-gray-900 block mt-0.5">
                        {subj.it2 !== null ? `${subj.it2}` : <span className="text-gray-300 font-normal italic">Pending</span>}
                      </span>
                      <span className="text-[10px] text-gray-400 block">/{subj.max_it_marks}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                      <span className="text-[11px] font-semibold text-gray-500 block">IT 3</span>
                      <span className="text-sm font-bold text-gray-900 block mt-0.5">
                        {subj.it3 !== null ? `${subj.it3}` : <span className="text-gray-300 font-normal italic">Pending</span>}
                      </span>
                      <span className="text-[10px] text-gray-400 block">/{subj.max_it_marks}</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                      <span className="text-[11px] font-semibold text-gray-500 block">Assignment</span>
                      <span className="text-sm font-bold text-gray-900 block mt-0.5">
                        {subj.assignment !== null ? `${subj.assignment}` : <span className="text-gray-300 font-normal italic">Pending</span>}
                      </span>
                      <span className="text-[10px] text-gray-400 block">/{subj.max_assignment_marks}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
