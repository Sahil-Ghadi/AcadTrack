"use client";

import { useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  HelpCircle,
} from "lucide-react";

export type EntityType = "student" | "faculty" | "marks" | "attendance";

interface CanonicalField {
  key: string;
  label: string;
  required: boolean;
  description: string;
}

interface RowPreview {
  rowNumber: number;
  raw: Record<string, string>;
  mapped: Record<string, any>;
  isValid: boolean;
  errors: string[];
}

interface RowError {
  rowNumber: number;
  identifier?: string;
  error: string;
}

interface PreviewResponse {
  headers: string[];
  suggestedMappings: Record<string, string>;
  canonicalFields: CanonicalField[];
  totalRows: number;
  validRowCount: number;
  invalidRowCount: number;
  previewRows: RowPreview[];
  errors: RowError[];
}

interface ExecuteResponse {
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: RowError[];
  errorCsv?: string;
}

interface CsvImportWizardProps {
  entityType: EntityType;
  departmentId?: number;
  departments?: Array<{ id: number; name: string; code: string }>;
  assignmentId?: number;
  component?: "IT1" | "IT2" | "IT3" | "ASSIGNMENT";
  sessionId?: number;
  templateUrl?: string;
  templateFilename?: string;
  onCancel?: () => void;
  onComplete?: () => void;
}

export default function CsvImportWizard({
  entityType,
  departmentId: fixedDeptId,
  departments = [],
  assignmentId,
  component,
  sessionId,
  templateUrl,
  templateFilename,
  onCancel,
  onComplete,
}: CsvImportWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState<string>(
    fixedDeptId ? String(fixedDeptId) : departments[0] ? String(departments[0].id) : "",
  );

  // Preview & Mapping states
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [skipErrors, setSkipErrors] = useState(true);

  // Execute result
  const [executeResult, setExecuteResult] = useState<ExecuteResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFaculty = entityType === "faculty";
  const isMarks = entityType === "marks";
  const isAttendance = entityType === "attendance";
  const entityTitle = isFaculty
    ? "Faculty"
    : isMarks
    ? `Internal Marks (${component || ""})`
    : isAttendance
    ? "Attendance"
    : "Student";

  async function handleDownloadTemplate() {
    if (!templateUrl) return;
    setDownloadingTemplate(true);
    try {
      const csvText = await apiFetch<string>(templateUrl);
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = templateFilename || `${entityType}_template.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to download template");
    } finally {
      setDownloadingTemplate(false);
    }
  }

  // Handle file drop & selection
  function handleFileChange(selectedFile: File | null) {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith(".csv") && selectedFile.type !== "text/csv") {
      setErrorMsg("Please upload a valid .csv file");
      return;
    }
    setFile(selectedFile);
    setErrorMsg(null);
  }

  // Step 1 -> Step 2: Upload and generate preview / initial auto-mapping
  async function handleAnalyzeFile() {
    if (!file) {
      setErrorMsg("Please select a CSV file first");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("entity_type", entityType);
    const activeDeptId = fixedDeptId || (selectedDeptId ? Number(selectedDeptId) : undefined);
    if (activeDeptId) {
      formData.append("department_id", String(activeDeptId));
    }
    if (assignmentId) formData.append("assignment_id", String(assignmentId));
    if (component) formData.append("component", component);
    if (sessionId) formData.append("session_id", String(sessionId));

    try {
      const res = await apiFetch<PreviewResponse>("/api/import/preview", {
        method: "POST",
        body: formData,
      });

      setPreviewData(res);
      setMappings(res.suggestedMappings || {});
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to analyze CSV file");
    } finally {
      setLoading(false);
    }
  }

  // Step 2 -> Step 3: Re-validate with user-adjusted mappings
  async function handleRevalidateMappings() {
    if (!file) return;

    // Verify all required canonical fields are mapped
    const mappedCanonicalKeys = new Set(Object.values(mappings).filter(Boolean));
    const unmappedRequired = (previewData?.canonicalFields || [])
      .filter((f) => f.required && !mappedCanonicalKeys.has(f.key))
      .map((f) => f.label);

    if (unmappedRequired.length > 0) {
      setErrorMsg(
        `The following required fields must be mapped before previewing: ${unmappedRequired.join(", ")}`,
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("entity_type", entityType);
    formData.append("mappings", JSON.stringify(mappings));
    const activeDeptId = fixedDeptId || (selectedDeptId ? Number(selectedDeptId) : undefined);
    if (activeDeptId) {
      formData.append("department_id", String(activeDeptId));
    }
    if (assignmentId) formData.append("assignment_id", String(assignmentId));
    if (component) formData.append("component", component);
    if (sessionId) formData.append("session_id", String(sessionId));

    try {
      const res = await apiFetch<PreviewResponse>("/api/import/preview", {
        method: "POST",
        body: formData,
      });

      setPreviewData(res);
      setStep(3);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to preview mapped records");
    } finally {
      setLoading(false);
    }
  }

  // Step 4: Execute Transactional Import
  async function handleConfirmImport() {
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("entity_type", entityType);
    formData.append("mappings", JSON.stringify(mappings));
    formData.append("skip_errors", String(skipErrors));
    const activeDeptId = fixedDeptId || (selectedDeptId ? Number(selectedDeptId) : undefined);
    if (activeDeptId) {
      formData.append("department_id", String(activeDeptId));
    }
    if (assignmentId) formData.append("assignment_id", String(assignmentId));
    if (component) formData.append("component", component);
    if (sessionId) formData.append("session_id", String(sessionId));

    try {
      const res = await apiFetch<ExecuteResponse>("/api/import/execute", {
        method: "POST",
        body: formData,
      });

      setExecuteResult(res);
      setStep(5);
      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to execute bulk import");
    } finally {
      setLoading(false);
    }
  }

  // Trigger error CSV download
  function handleDownloadErrorCsv() {
    if (!executeResult?.errorCsv) return;
    const blob = new Blob([executeResult.errorCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${entityType}_import_failed_rows.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    setStep(1);
    setFile(null);
    setPreviewData(null);
    setMappings({});
    setExecuteResult(null);
    setErrorMsg(null);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Wizard Progress Bar */}
      <div className="border-b border-gray-100 bg-gray-50/50 p-4 sm:px-6 relative">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="absolute right-4 top-4 text-xs font-semibold px-2.5 py-1 text-gray-500 hover:text-gray-800 hover:bg-gray-200/60 rounded-lg transition"
          >
            ✕ Close
          </button>
        )}
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {[
            { num: 1, label: "Upload" },
            { num: 2, label: "Map Columns" },
            { num: 3, label: "Preview" },
            { num: 4, label: "Confirm" },
            { num: 5, label: "Results" },
          ].map((s) => {
            const isCurrent = step === s.num;
            const isDone = step > s.num;
            return (
              <div key={s.num} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    isCurrent
                      ? "bg-indigo-600 text-white ring-4 ring-indigo-50"
                      : isDone
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isDone ? <CheckCircle className="w-4 h-4" /> : s.num}
                </div>
                <span
                  className={`text-xs font-semibold hidden sm:inline ${
                    isCurrent ? "text-indigo-900" : isDone ? "text-gray-700" : "text-gray-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="mx-6 mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMsg}</div>
        </div>
      )}

      {/* STEP 1: UPLOAD */}
      {step === 1 && (
        <div className="p-6 sm:p-8 max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-gray-900">
              Import {entityTitle} Records via CSV
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Upload any spreadsheet. Headers will be automatically mapped to AcadTrack fields.
            </p>
          </div>

          {templateUrl && (
            <div className="mb-5 p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-indigo-950">Pre-filled Roster Template</p>
                <p className="text-[11px] text-indigo-700">Download a CSV template pre-populated with eligible students</p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-50 shadow-2xs shrink-0 disabled:opacity-50"
              >
                {downloadingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Download Template
              </button>
            </div>
          )}

          {!fixedDeptId && !isMarks && !isAttendance && departments.length > 0 && (
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Target Department Scope
              </label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Records without an explicit department in the CSV will default to this department.
              </p>
            </div>
          )}

          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
              isDragging
                ? "border-indigo-500 bg-indigo-50/50"
                : file
                ? "border-emerald-300 bg-emerald-50/20"
                : "border-gray-300 hover:border-gray-400 bg-gray-50/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />

            <div className="flex flex-col items-center justify-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  file ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
                }`}
              >
                {file ? <FileSpreadsheet className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
              </div>

              <div>
                {file ? (
                  <>
                    <p className="text-sm font-bold text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB &bull; Ready to analyze
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-gray-700">
                      Drag & drop your CSV file here, or{" "}
                      <span className="text-indigo-600 font-bold underline">browse</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Supports comma and semicolon delimiters, UTF-8 BOM, and quoted text
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Information Notice */}
          {isMarks ? (
            <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 text-xs flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Validation Notice:</strong> Marks are validated against assessment maximum marks and student section/lab enrollment. Existing scores will NOT be overwritten.
              </div>
            </div>
          ) : isAttendance ? (
            <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 text-xs flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Validation Notice:</strong> Attendance status accepts Present (<code>P</code>, <code>Present</code>, <code>1</code>) or Absent (<code>A</code>, <code>Absent</code>, <code>0</code>). Existing attendance records cannot be overwritten.
              </div>
            </div>
          ) : (
            <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 text-xs flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Initial Password Convention:</strong> Accounts will be provisioned with secure
                default passwords:{" "}
                <code>{isFaculty ? "Staff@<EmployeeCode>" : "Acad@<RollNo>"}</code>. Passwords are
                never stored in plaintext.
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleAnalyzeFile}
              disabled={!file || loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing CSV...
                </>
              ) : (
                <>
                  Map Columns <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {step === 2 && previewData && (
        <div className="p-6 sm:p-8 max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Map CSV Columns</h2>
              <p className="text-xs text-gray-500">
                Match your spreadsheet headers to AcadTrack fields. Auto-detected matches are pre-filled.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full self-start">
              {previewData.headers.length} Columns Detected &bull; {previewData.totalRows} Data Rows
            </span>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Your CSV Column
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase w-12">
                    &rarr;
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    AcadTrack Field
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Status / Requirement
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {previewData.headers.map((hdr) => {
                  const currentMappedKey = mappings[hdr] || "";
                  const canonical = previewData.canonicalFields.find(
                    (f) => f.key === currentMappedKey,
                  );

                  return (
                    <tr key={hdr} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-semibold text-gray-800 font-mono text-xs">
                        {hdr}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400 text-xs font-bold">
                        &rarr;
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={currentMappedKey}
                          onChange={(e) => {
                            const newKey = e.target.value;
                            setMappings((prev) => ({
                              ...prev,
                              [hdr]: newKey,
                            }));
                          }}
                          className={`w-full px-3 py-1.5 border rounded-lg text-xs font-medium bg-white ${
                            currentMappedKey
                              ? "border-indigo-400 text-indigo-900 bg-indigo-50/30"
                              : "border-gray-300 text-gray-500"
                          }`}
                        >
                          <option value="">(Do not import / Ignore)</option>
                          {previewData.canonicalFields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label} {f.required ? "*" : "(optional)"}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {canonical ? (
                          <span
                            className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[11px] ${
                              canonical.required
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {canonical.required ? "Required" : "Optional"}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">Ignored</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Upload
            </button>

            <button
              onClick={handleRevalidateMappings}
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Validating...
                </>
              ) : (
                <>
                  Preview Records <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW & VALIDATION */}
      {step === 3 && previewData && (
        <div className="p-6 sm:p-8 max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Validation & Data Preview</h2>
              <p className="text-xs text-gray-500">
                Review records before importing into PostgreSQL.
              </p>
            </div>

            {/* Metrics pills */}
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-700">
                Total: <strong>{previewData.totalRows}</strong>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Valid:{" "}
                <strong>{previewData.validRowCount}</strong>
              </div>
              {previewData.invalidRowCount > 0 && (
                <div className="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-red-600" /> Invalid:{" "}
                  <strong>{previewData.invalidRowCount}</strong>
                </div>
              )}
            </div>
          </div>

          {/* First 10 Rows Preview Table */}
          <div className="border border-gray-200 rounded-xl overflow-x-auto mb-6">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2.5 text-center font-bold text-gray-500 uppercase w-12">
                    Row
                  </th>
                  <th className="px-3 py-2.5 text-center font-bold text-gray-500 uppercase w-20">
                    Status
                  </th>
                  {isFaculty ? (
                    <>
                      <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase">
                        Employee Code
                      </th>
                      <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase">
                        Full Name
                      </th>
                      <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase">
                        Email
                      </th>
                      <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase">
                        Designation
                      </th>
                    </>
                  ) : isMarks ? (
                    <>
                      <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase">
                        Roll No
                      </th>
                      <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase">
                        Student Name
                      </th>
                      <th className="px-3 py-2.5 text-center font-bold text-gray-500 uppercase">
                        Marks
                      </th>
                    </>
                  ) : isAttendance ? (
                    <>
                      <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase">
                        Roll No
                      </th>
                      <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase">
                        Student Name
                      </th>
                      <th className="px-3 py-2.5 text-center font-bold text-gray-500 uppercase">
                        Attendance Status
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase">
                        Roll No
                      </th>
                      <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase">
                        Full Name
                      </th>
                      <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase">
                        Email
                      </th>
                      <th className="px-3 py-2.5 text-center font-bold text-gray-500 uppercase">
                        Section
                      </th>
                      <th className="px-3 py-2.5 text-center font-bold text-gray-500 uppercase">
                        Lab Group
                      </th>
                      <th className="px-3 py-2.5 text-center font-bold text-gray-500 uppercase">
                        Year
                      </th>
                    </>
                  )}
                  <th className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase">
                    Validation Message
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {previewData.previewRows.map((r) => (
                  <tr
                    key={r.rowNumber}
                    className={r.isValid ? "hover:bg-gray-50/50" : "bg-red-50/30 hover:bg-red-50/50"}
                  >
                    <td className="px-3 py-2 text-center font-mono text-gray-400 font-bold">
                      {r.rowNumber}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.isValid ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          VALID
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                          ERROR
                        </span>
                      )}
                    </td>
                    {isFaculty ? (
                      <>
                        <td className="px-3 py-2 font-mono font-bold text-gray-900">
                          {r.mapped.employee_code || "-"}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {r.mapped.full_name || "-"}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{r.mapped.email || "-"}</td>
                        <td className="px-3 py-2 text-gray-500">
                          {r.mapped.designation || "-"}
                        </td>
                      </>
                    ) : isMarks ? (
                      <>
                        <td className="px-3 py-2 font-mono font-bold text-gray-900">
                          {r.mapped.roll_no || "-"}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {r.mapped.student_name || "-"}
                        </td>
                        <td className="px-3 py-2 text-center font-bold text-gray-800">
                          {r.mapped.marks ?? r.mapped.marks_obtained ?? "-"}
                        </td>
                      </>
                    ) : isAttendance ? (
                      <>
                        <td className="px-3 py-2 font-mono font-bold text-gray-900">
                          {r.mapped.roll_no || "-"}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {r.mapped.student_name || "-"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              r.mapped.status === "present"
                                ? "bg-emerald-100 text-emerald-800"
                                : r.mapped.status === "absent"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {r.mapped.status || "-"}
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 font-mono font-bold text-gray-900">
                          {r.mapped.roll_no || "-"}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {r.mapped.full_name || "-"}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{r.mapped.email || "-"}</td>
                        <td className="px-3 py-2 text-center font-semibold text-gray-700">
                          {r.raw[Object.keys(mappings).find((k) => mappings[k] === "section") || ""] || "-"}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">
                          {r.raw[Object.keys(mappings).find((k) => mappings[k] === "lab_group") || ""] || "-"}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">
                          {r.mapped.admission_year || "-"}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2 text-xs">
                      {r.isValid ? (
                        <span className="text-emerald-600 font-medium">Ready</span>
                      ) : (
                        <span className="text-red-600 font-medium">
                          {r.errors.join("; ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Validation Errors Box if any */}
          {previewData.errors.length > 0 && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <h4 className="text-xs font-bold text-amber-900 uppercase mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Row Errors ({previewData.errors.length} issues identified)
              </h4>
              <div className="max-h-36 overflow-y-auto space-y-1 text-xs text-amber-800">
                {previewData.errors.slice(0, 10).map((err, i) => (
                  <p key={i}>
                    &bull; Row <strong>{err.rowNumber}</strong>{" "}
                    {err.identifier && `(${err.identifier})`}: {err.error}
                  </p>
                ))}
                {previewData.errors.length > 10 && (
                  <p className="font-semibold text-amber-900 pt-1">
                    ...and {previewData.errors.length - 10} more errors
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Options */}
          <div className="mb-6 flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <input
              type="checkbox"
              id="skipErrorsCheckbox"
              checked={skipErrors}
              onChange={(e) => setSkipErrors(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <label htmlFor="skipErrorsCheckbox" className="text-xs font-medium text-gray-700 cursor-pointer">
              <strong>Skip invalid records and import valid rows</strong> (Recommended: Allows
              importing valid data while generating an error report for failed rows)
            </label>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Mapping
            </button>

            <button
              onClick={() => setStep(4)}
              disabled={previewData.validRowCount === 0}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-2"
            >
              Continue to Confirm <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: CONFIRMATION */}
      {step === 4 && previewData && (
        <div className="p-6 sm:p-8 max-w-xl mx-auto">
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              Confirm {entityTitle} Import
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Please review the batch summary before executing the database transaction.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3 text-xs text-gray-700 mb-6">
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="font-semibold text-gray-500">Target Entity:</span>
              <strong className="text-gray-900 capitalize">{entityType}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="font-semibold text-gray-500">Total File Records:</span>
              <strong className="text-gray-900">{previewData.totalRows}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-200 text-emerald-700">
              <span className="font-semibold">Records to be Imported:</span>
              <strong>{previewData.validRowCount}</strong>
            </div>
            {previewData.invalidRowCount > 0 && (
              <div className="flex justify-between py-1 border-b border-gray-200 text-amber-700">
                <span className="font-semibold">Records to be Skipped:</span>
                <strong>{previewData.invalidRowCount}</strong>
              </div>
            )}
            {isMarks && component && (
              <div className="flex justify-between py-1">
                <span className="font-semibold text-gray-500">Assessment:</span>
                <strong className="text-gray-900">{component}</strong>
              </div>
            )}
            {isAttendance && sessionId && (
              <div className="flex justify-between py-1">
                <span className="font-semibold text-gray-500">Lecture Session ID:</span>
                <strong className="text-gray-900">{sessionId}</strong>
              </div>
            )}
            {!isMarks && !isAttendance && (
              <div className="flex justify-between py-1">
                <span className="font-semibold text-gray-500">Initial Password:</span>
                <span className="font-mono text-gray-800">
                  {isFaculty ? "Staff@<EmployeeCode>" : "Acad@<RollNo>"}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel / Back
            </button>

            <button
              onClick={handleConfirmImport}
              disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 transition"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Importing Records...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" /> Start Import Now
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: RESULTS */}
      {step === 5 && executeResult && (
        <div className="p-6 sm:p-8 max-w-xl mx-auto text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-gray-900">Import Completed!</h2>
          <p className="text-xs text-gray-500 mt-1 mb-6">
            Database transaction committed successfully.
          </p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-500">Processed</p>
              <p className="text-lg font-bold text-gray-900">{executeResult.totalRows}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <p className="text-xs font-semibold text-emerald-700">Imported</p>
              <p className="text-lg font-bold text-emerald-800">
                {executeResult.importedCount}
              </p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-xs font-semibold text-amber-700">Skipped</p>
              <p className="text-lg font-bold text-amber-800">
                {executeResult.skippedCount}
              </p>
            </div>
          </div>

          {executeResult.errorCsv && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-left">
              <p className="text-xs font-bold text-amber-900 mb-1">
                {executeResult.skippedCount} record(s) were skipped due to validation errors.
              </p>
              <p className="text-[11px] text-amber-700 mb-3">
                Download the error spreadsheet to inspect row-specific error messages.
              </p>
              <button
                onClick={handleDownloadErrorCsv}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" /> Download Error CSV
              </button>
            </div>
          )}

          <div className="flex justify-center gap-3">
            <button
              onClick={handleReset}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Import Another CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

