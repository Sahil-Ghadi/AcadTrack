import { z } from "zod";

// --- Users, Students, Faculty ---
export const createStudentUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  section_id: z.number().int().positive(),
  lab_group_id: z.number().int().positive().nullable().optional(),
  roll_no: z.string().min(1).max(20),
  full_name: z.string().min(1).max(100),
  admission_year: z.number().int().min(2000).max(2100),
});

export const createFacultyUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  department_id: z.number().int().positive(),
  employee_code: z.string().min(1).max(20),
  full_name: z.string().min(1).max(100),
  designation: z.string().max(50).optional(),
});

export const deactivateUserSchema = z.object({
  is_active: z.boolean(),
});

// --- Subjects ---
export const createSubjectSchema = z.object({
  department_id: z.number().int().positive(),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(120),
  subject_type: z.enum(["theory", "lab"]),
  semester: z.number().int().min(1).max(12),
  is_elective: z.boolean().default(false),
  max_it_marks: z.number().positive().default(20),
  max_assignment_marks: z.number().positive().default(10),
});

export const updateSubjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  subject_type: z.enum(["theory", "lab"]).optional(),
  semester: z.number().int().min(1).max(12).optional(),
  is_elective: z.boolean().optional(),
  max_it_marks: z.number().positive().optional(),
  max_assignment_marks: z.number().positive().optional(),
  is_active: z.boolean().optional(),
});

// --- Subject Assignment ---
export const createSubjectAssignmentSchema = z.object({
  subject_id: z.number().int().positive(),
  faculty_id: z.number().int().positive(),
  section_id: z.number().int().positive(),
  lab_group_id: z.number().int().positive().nullable().optional(),
  term_id: z.number().int().positive(),
});

// --- Elective Enrollment ---
export const createElectiveEnrollmentSchema = z.object({
  student_id: z.number().int().positive(),
  subject_id: z.number().int().positive(),
  term_id: z.number().int().positive(),
});

export const bulkElectiveEnrollmentSchema = z.object({
  student_ids: z.array(z.number().int().positive()).min(1),
  subject_id: z.number().int().positive(),
  term_id: z.number().int().positive(),
});
