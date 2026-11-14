import { z } from "zod";

// --- Department ---
export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(10),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(10).optional(),
  is_active: z.boolean().optional(),
});

// --- Program ---
export const createProgramSchema = z.object({
  department_id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  level: z.enum(["B.E.", "M.E."]),
  duration_years: z.number().int().min(1).max(6),
});

export const updateProgramSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  level: z.enum(["B.E.", "M.E."]).optional(),
  duration_years: z.number().int().min(1).max(6).optional(),
  is_active: z.boolean().optional(),
});

// --- Batch ---
export const createBatchSchema = z.object({
  program_id: z.number().int().positive(),
  start_year: z.number().int().min(2000).max(2100),
  end_year: z.number().int().min(2001).max(2106),
});

export const updateBatchSchema = z.object({
  is_active: z.boolean().optional(),
});

// --- Section ---
export const createSectionSchema = z.object({
  batch_id: z.number().int().positive(),
  name: z.string().min(1).max(10),
});

// --- Lab Group ---
export const createLabGroupSchema = z.object({
  section_id: z.number().int().positive(),
  name: z.string().min(1).max(10),
});

// --- Academic Term ---
export const createAcademicTermSchema = z.object({
  academic_year: z.string().regex(/^\d{4}-\d{4}$/, "Must be in format YYYY-YYYY"),
  term_type: z.enum(["odd", "even"]),
  start_date: z.string().date(),
  end_date: z.string().date(),
  is_current: z.boolean().optional(),
});

export const updateAcademicTermSchema = z.object({
  academic_year: z.string().regex(/^\d{4}-\d{4}$/).optional(),
  term_type: z.enum(["odd", "even"]).optional(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
  is_current: z.boolean().optional(),
});

// --- Settings ---
export const updateSettingsSchema = z.object({
  attendance_threshold: z.number().min(0).max(100),
});

