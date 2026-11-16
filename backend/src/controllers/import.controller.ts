import type { Request, Response } from "express";
import * as importService from "../services/import.service";
import {
  importPreviewSchema,
  importExecuteSchema,
  marksTemplateQuerySchema,
  attendanceTemplateQuerySchema,
} from "../validators/import.validator";

function getCollegeId(req: Request): number {
  return req.user!.collegeId;
}

function resolveDepartmentScope(req: Request, requestedDeptId?: number): number | undefined {
  if (req.user!.role === "dept_admin") {
    // Dept admin is strictly scoped to their own department
    return req.user!.departmentId!;
  }
  // College admin can target any department in their college
  return requestedDeptId;
}

export async function previewImport(req: Request, res: Response): Promise<void> {
  if (!req.file || !req.file.buffer) {
    res.status(400).json({ message: "No CSV file uploaded. Please attach a file under key 'file'." });
    return;
  }

  const parsed = importPreviewSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;

  if (req.user!.role === "faculty" && parsed.data.entity_type !== "marks" && parsed.data.entity_type !== "attendance") {
    res.status(403).json({ message: "Forbidden: Faculty can only import marks and attendance" });
    return;
  }

  const departmentId = resolveDepartmentScope(req, parsed.data.department_id);

  const preview = await importService.previewCsv(
    getCollegeId(req),
    req.file.buffer,
    parsed.data.entity_type,
    parsed.data.mappings,
    {
      departmentId,
      programId: parsed.data.program_id,
      batchId: parsed.data.batch_id,
      sectionId: parsed.data.section_id,
      assignmentId: parsed.data.assignment_id,
      component: parsed.data.component,
      sessionId: parsed.data.session_id,
      termId: parsed.data.term_id,
      userId: req.user!.id,
      userRole: req.user!.role,
    },
  );

  res.json(preview);
}

export async function executeImport(req: Request, res: Response): Promise<void> {
  if (!req.file || !req.file.buffer) {
    res.status(400).json({ message: "No CSV file uploaded. Please attach a file under key 'file'." });
    return;
  }

  const parsed = importExecuteSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;

  if (req.user!.role === "faculty" && parsed.data.entity_type !== "marks" && parsed.data.entity_type !== "attendance") {
    res.status(403).json({ message: "Forbidden: Faculty can only import marks and attendance" });
    return;
  }

  const departmentId = resolveDepartmentScope(req, parsed.data.department_id);

  const result = await importService.executeImport(
    getCollegeId(req),
    req.file.buffer,
    parsed.data.entity_type,
    parsed.data.mappings,
    {
      departmentId,
      programId: parsed.data.program_id,
      batchId: parsed.data.batch_id,
      sectionId: parsed.data.section_id,
      assignmentId: parsed.data.assignment_id,
      component: parsed.data.component,
      sessionId: parsed.data.session_id,
      termId: parsed.data.term_id,
      userId: req.user!.id,
      userRole: req.user!.role,
      skipErrors: parsed.data.skip_errors,
    },
  );

  res.status(200).json(result);
}

export async function downloadMarksTemplate(req: Request, res: Response): Promise<void> {
  const parsed = marksTemplateQuerySchema.safeParse(req.query);
  if (!parsed.success) throw parsed.error;

  const { csv, filename } = await importService.generateMarksTemplate(
    getCollegeId(req),
    parsed.data.assignment_id,
    parsed.data.component,
    req.user!.id,
    req.user!.role,
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

export async function downloadAttendanceTemplate(req: Request, res: Response): Promise<void> {
  const parsed = attendanceTemplateQuerySchema.safeParse(req.query);
  if (!parsed.success) throw parsed.error;

  const { csv, filename } = await importService.generateAttendanceTemplate(
    getCollegeId(req),
    parsed.data.session_id,
    req.user!.id,
    req.user!.role,
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

export async function downloadTimetableTemplate(req: Request, res: Response): Promise<void> {
  const departmentId = resolveDepartmentScope(
    req,
    req.query.department_id ? Number(req.query.department_id) : undefined,
  );
  const termId = req.query.term_id ? Number(req.query.term_id) : undefined;

  const { csv, filename } = await importService.generateTimetableTemplate(
    getCollegeId(req),
    departmentId,
    termId,
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}
