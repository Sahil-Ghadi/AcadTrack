"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { apiFetch } from "@/lib/api";
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
} from "lucide-react";

export default function DeptAdminDashboard() {
  const [activeTab, setActiveTab] = useState<"timetable" | "subjects" | "assignments">("timetable");

  // Timetable state
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showAddSlot, setShowAddSlot] = useState(false);
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
  const [assignForm, setAssignForm] = useState({
    subject_id: "",
    faculty_id: "",
    section_id: "",
  });

  // Notification banners
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

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
        });
      }
    } catch {}
    finally {
      setLoadingSlots(false);
      setLoadingSubjects(false);
    }
  }

  // --- Add Timetable Slot with Clash Detection ---
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
      // 409 Conflict: room or faculty clash
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

  // --- Add Subject ---
  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    setBannerSuccess(null);
    setBannerError(null);

    try {
      await apiFetch<any>("/api/academic/subjects", {
        method: "POST",
        body: JSON.stringify({
          department_id: 1, // Computer Engineering CO
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

  // --- Add Assignment ---
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

  const days = [
    { num: 1, name: "Monday" },
    { num: 2, name: "Tuesday" },
    { num: 3, name: "Wednesday" },
    { num: 4, name: "Thursday" },
    { num: 5, name: "Friday" },
    { num: 6, name: "Saturday" },
  ];

  const periods = [1, 2, 3, 4, 5, 6];

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Department Administration</h1>
            <p className="text-xs text-gray-500 mt-1">
              Computer Engineering &bull; Current Term:{" "}
              <strong className="text-gray-700">{currentTerm ? `${currentTerm.academic_year} (${currentTerm.term_type})` : "Active"}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "timetable" && (
              <button
                onClick={() => setShowAddSlot(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" /> Add Timetable Slot
              </button>
            )}

            {activeTab === "subjects" && (
              <button
                onClick={() => setShowAddSubject(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" /> Add New Subject
              </button>
            )}

            {activeTab === "assignments" && (
              <button
                onClick={() => setShowAddAssign(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" /> Assign Faculty
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6 gap-2">
          <button
            onClick={() => setActiveTab("timetable")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === "timetable"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Calendar className="w-4 h-4" /> Timetable Grid & Clash Prevention
          </button>

          <button
            onClick={() => setActiveTab("subjects")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === "subjects"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <BookOpen className="w-4 h-4" /> Subjects Curriculum ({subjects.length})
          </button>

          <button
            onClick={() => setActiveTab("assignments")}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition ${
              activeTab === "assignments"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Users className="w-4 h-4" /> Faculty Assignments ({assignments.length})
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
            <span>
              <strong>Schedule Conflict / Error:</strong> {bannerError}
            </span>
          </div>
        )}

        {/* ==================== TAB 1: TIMETABLE GRID ==================== */}
        {activeTab === "timetable" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Weekly Department Timetable</h2>
                <p className="text-xs text-gray-500">
                  Clashes for rooms and faculty across the term are enforced by PostgreSQL UNIQUE constraints.
                </p>
              </div>
            </div>

            {loadingSlots ? (
              <div className="py-20 text-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                Loading timetable matrix...
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="min-w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b border-r border-gray-200 p-3 text-left text-xs font-bold text-gray-500 uppercase w-32">
                        Day / Period
                      </th>
                      {periods.map((p) => (
                        <th key={p} className="border-b border-r border-gray-200 p-3 text-center text-xs font-bold text-gray-600 uppercase">
                          Period {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {days.map((d) => (
                      <tr key={d.num}>
                        <td className="border-r border-gray-200 p-3 text-xs font-bold text-gray-900 bg-gray-50/50">
                          {d.name}
                        </td>
                        {periods.map((p) => {
                          const slot = slots.find((s) => s.day_of_week === d.num && s.period_no === p);
                          return (
                            <td
                              key={p}
                              className={`border-r border-gray-100 p-2.5 text-center min-w-[140px] align-top ${
                                slot ? "bg-indigo-50/30" : "bg-white"
                              }`}
                            >
                              {slot ? (
                                <div className="p-2 rounded-lg bg-white border border-indigo-100 shadow-2xs text-left relative group">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-xs text-indigo-900">{slot.subject_code}</span>
                                    <button
                                      onClick={() => handleDeleteSlot(slot.id)}
                                      className="text-gray-300 hover:text-red-600 transition"
                                      title="Delete slot"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <p className="text-[11px] font-medium text-gray-700 truncate mt-0.5">{slot.subject_name}</p>
                                  <p className="text-[10px] text-gray-500 mt-1">
                                    Room <strong>{slot.room}</strong> &bull; Sec {slot.section_name}
                                  </p>
                                  <p className="text-[10px] text-indigo-600 truncate">{slot.faculty_name}</p>
                                </div>
                              ) : (
                                <span className="text-gray-200 text-xs">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 2: SUBJECTS ==================== */}
        {activeTab === "subjects" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Curriculum Subjects</h2>
              <p className="text-xs text-gray-500">Configured theory & lab subjects with component maximum marks.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Subject Name</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Semester</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Max IT Marks</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Max Assign Marks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {subjects.map((sub) => (
                    <tr key={sub.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3 font-mono font-bold text-indigo-700">{sub.code}</td>
                      <td className="px-6 py-3 font-medium text-gray-900">
                        {sub.name}
                        {sub.is_elective && (
                          <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            Elective
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 capitalize text-gray-600">{sub.subject_type}</td>
                      <td className="px-6 py-3 text-gray-600">{sub.semester}</td>
                      <td className="px-6 py-3 text-center font-semibold text-gray-800">{sub.max_it_marks}</td>
                      <td className="px-6 py-3 text-center font-semibold text-gray-800">{sub.max_assignment_marks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== TAB 3: ASSIGNMENTS ==================== */}
        {activeTab === "assignments" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Teaching Allocations</h2>
              <p className="text-xs text-gray-500">Mapping of faculty to subjects and student sections for the current academic term.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Faculty Member</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Section</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Lab Group</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Academic Term</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {assignments.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3">
                        <span className="font-mono font-bold text-xs text-indigo-700 block">{a.subject_code}</span>
                        <span className="font-medium text-gray-900 text-xs">{a.subject_name}</span>
                      </td>
                      <td className="px-6 py-3 font-semibold text-gray-800">
                        {a.faculty_name}{" "}
                        <span className="text-xs text-gray-400 font-normal">({a.employee_code})</span>
                      </td>
                      <td className="px-6 py-3 font-medium text-gray-700">Section {a.section_name}</td>
                      <td className="px-6 py-3 text-gray-500">{a.lab_group_name || "Entire Section"}</td>
                      <td className="px-6 py-3 text-xs text-gray-500 font-mono">
                        {a.academic_year} ({a.term_type})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Add Timetable Slot */}
        {showAddSlot && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Add Timetable Slot</h3>
              <form onSubmit={handleAddSlot} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Subject Assignment</label>
                  <select
                    value={slotForm.subject_assignment_id}
                    onChange={(e) => setSlotForm({ ...slotForm, subject_assignment_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                  >
                    {assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.subject_code} ({a.faculty_name} - Sec {a.section_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Day of Week</label>
                    <select
                      value={slotForm.day_of_week}
                      onChange={(e) => setSlotForm({ ...slotForm, day_of_week: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                    >
                      {days.map((d) => (
                        <option key={d.num} value={d.num}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Period No</label>
                    <select
                      value={slotForm.period_no}
                      onChange={(e) => setSlotForm({ ...slotForm, period_no: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                    >
                      {periods.map((p) => (
                        <option key={p} value={p}>
                          Period {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Start Time</label>
                    <input
                      type="time"
                      value={slotForm.start_time}
                      onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">End Time</label>
                    <input
                      type="time"
                      value={slotForm.end_time}
                      onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Room</label>
                    <input
                      type="text"
                      value={slotForm.room}
                      onChange={(e) => setSlotForm({ ...slotForm, room: e.target.value })}
                      required
                      placeholder="R204"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddSlot(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-xs"
                  >
                    Schedule Slot
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Subject */}
        {showAddSubject && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Add Subject to Curriculum</h3>
              <form onSubmit={handleAddSubject} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Code</label>
                    <input
                      type="text"
                      value={subjectForm.code}
                      onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                      required
                      placeholder="CO504"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Semester</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={subjectForm.semester}
                      onChange={(e) => setSubjectForm({ ...subjectForm, semester: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Subject Name</label>
                  <input
                    type="text"
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                    required
                    placeholder="Theory of Computation"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Type</label>
                    <select
                      value={subjectForm.subject_type}
                      onChange={(e) => setSubjectForm({ ...subjectForm, subject_type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                    >
                      <option value="theory">Theory</option>
                      <option value="lab">Lab</option>
                    </select>
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={subjectForm.is_elective}
                        onChange={(e) => setSubjectForm({ ...subjectForm, is_elective: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      Is Elective Subject
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Max IT Marks</label>
                    <input
                      type="number"
                      min="1"
                      value={subjectForm.max_it_marks}
                      onChange={(e) => setSubjectForm({ ...subjectForm, max_it_marks: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Max Assignment</label>
                    <input
                      type="number"
                      min="1"
                      value={subjectForm.max_assignment_marks}
                      onChange={(e) => setSubjectForm({ ...subjectForm, max_assignment_marks: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddSubject(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-xs"
                  >
                    Save Subject
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Faculty Assignment */}
        {showAddAssign && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Assign Subject to Faculty</h3>
              <form onSubmit={handleAddAssignment} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Subject</label>
                  <select
                    value={assignForm.subject_id}
                    onChange={(e) => setAssignForm({ ...assignForm, subject_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Faculty Member</label>
                  <select
                    value={assignForm.faculty_id}
                    onChange={(e) => setAssignForm({ ...assignForm, faculty_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                  >
                    {facultyList.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.full_name} ({f.employee_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Section</label>
                  <select
                    value={assignForm.section_id}
                    onChange={(e) => setAssignForm({ ...assignForm, section_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                  >
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        Section {sec.name} ({sec.program_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddAssign(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-xs"
                  >
                    Create Assignment
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
