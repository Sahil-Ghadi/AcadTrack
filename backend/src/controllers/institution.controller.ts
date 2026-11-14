import type { Request, Response } from "express";
import * as institutionService from "../services/institution.service";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  createProgramSchema,
  updateProgramSchema,
  createBatchSchema,
  updateBatchSchema,
  createSectionSchema,
  createLabGroupSchema,
  createAcademicTermSchema,
  updateAcademicTermSchema,
  updateSettingsSchema,
} from "../validators/institution.validator";

// Helper: throw if not scoped
function collegeId(req: Request): number {
  return req.user!.collegeId;
}

// Helper: dept_admin can only see/modify their own department
function scopedDeptId(req: Request): number | undefined {
  if (req.user!.role === "dept_admin") return req.user!.departmentId!;
  return undefined; // college_admin sees all
}

// ======================== DEPARTMENTS ========================

export async function listDepartments(req: Request, res: Response) {
  const rows = await institutionService.listDepartments(collegeId(req));
  res.json(rows);
}

export async function getDepartment(req: Request, res: Response) {
  const row = await institutionService.getDepartment(Number(req.params.id), collegeId(req));
  if (!row) { res.status(404).json({ message: "Department not found" }); return; }
  res.json(row);
}

export async function createDepartment(req: Request, res: Response) {
  const parsed = createDepartmentSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await institutionService.createDepartment(collegeId(req), parsed.data);
  res.status(201).json(row);
}

export async function updateDepartment(req: Request, res: Response) {
  const parsed = updateDepartmentSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await institutionService.updateDepartment(Number(req.params.id), collegeId(req), parsed.data);
  if (!row) { res.status(404).json({ message: "Department not found" }); return; }
  res.json(row);
}

// ======================== PROGRAMS ========================

export async function listPrograms(req: Request, res: Response) {
  const deptId = req.query.department_id ? Number(req.query.department_id) : scopedDeptId(req);
  const rows = await institutionService.listPrograms(collegeId(req), deptId);
  res.json(rows);
}

export async function getProgram(req: Request, res: Response) {
  const row = await institutionService.getProgram(Number(req.params.id), collegeId(req));
  if (!row) { res.status(404).json({ message: "Program not found" }); return; }
  res.json(row);
}

export async function createProgram(req: Request, res: Response) {
  const parsed = createProgramSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await institutionService.createProgram(collegeId(req), parsed.data);
  res.status(201).json(row);
}

export async function updateProgram(req: Request, res: Response) {
  const parsed = updateProgramSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await institutionService.updateProgram(Number(req.params.id), collegeId(req), parsed.data);
  if (!row) { res.status(404).json({ message: "Program not found" }); return; }
  res.json(row);
}

// ======================== BATCHES ========================

export async function listBatches(req: Request, res: Response) {
  const deptId = req.query.department_id ? Number(req.query.department_id) : scopedDeptId(req);
  const rows = await institutionService.listBatches(collegeId(req), deptId);
  res.json(rows);
}

export async function createBatch(req: Request, res: Response) {
  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await institutionService.createBatch(collegeId(req), parsed.data);
  res.status(201).json(row);
}

export async function updateBatch(req: Request, res: Response) {
  const parsed = updateBatchSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await institutionService.updateBatch(Number(req.params.id), collegeId(req), parsed.data);
  if (!row) { res.status(404).json({ message: "Batch not found" }); return; }
  res.json(row);
}

// ======================== SECTIONS ========================

export async function listSections(req: Request, res: Response) {
  const batchId = req.query.batch_id ? Number(req.query.batch_id) : undefined;
  const rows = await institutionService.listSections(collegeId(req), batchId);
  res.json(rows);
}

export async function createSection(req: Request, res: Response) {
  const parsed = createSectionSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await institutionService.createSection(collegeId(req), parsed.data);
  res.status(201).json(row);
}

// ======================== LAB GROUPS ========================

export async function listLabGroups(req: Request, res: Response) {
  const sectionId = req.query.section_id ? Number(req.query.section_id) : undefined;
  const rows = await institutionService.listLabGroups(collegeId(req), sectionId);
  res.json(rows);
}

export async function createLabGroup(req: Request, res: Response) {
  const parsed = createLabGroupSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await institutionService.createLabGroup(collegeId(req), parsed.data);
  res.status(201).json(row);
}

// ======================== ACADEMIC TERMS ========================

export async function listAcademicTerms(req: Request, res: Response) {
  const rows = await institutionService.listAcademicTerms(collegeId(req));
  res.json(rows);
}

export async function getCurrentTerm(req: Request, res: Response) {
  const row = await institutionService.getCurrentTerm(collegeId(req));
  if (!row) { res.status(404).json({ message: "No current term set" }); return; }
  res.json(row);
}

export async function createAcademicTerm(req: Request, res: Response) {
  const parsed = createAcademicTermSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await institutionService.createAcademicTerm(collegeId(req), parsed.data);
  res.status(201).json(row);
}

export async function updateAcademicTerm(req: Request, res: Response) {
  const parsed = updateAcademicTermSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await institutionService.updateAcademicTerm(Number(req.params.id), collegeId(req), parsed.data);
  if (!row) { res.status(404).json({ message: "Academic term not found" }); return; }
  res.json(row);
}

// ======================== SETTINGS ========================

export async function getSettings(req: Request, res: Response) {
  const row = await institutionService.getSettings(collegeId(req));
  if (!row) { res.status(404).json({ message: "Settings not found" }); return; }
  res.json(row);
}

export async function updateSettings(req: Request, res: Response) {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await institutionService.upsertSettings(collegeId(req), parsed.data);
  res.json(row);
}

