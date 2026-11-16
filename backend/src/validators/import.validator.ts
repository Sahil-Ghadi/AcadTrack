import { z } from "zod";

export const importPreviewSchema = z.object({
  entity_type: z.enum(["student", "faculty", "marks", "attendance", "timetable"]),
  department_id: z.coerce.number().int().positive().optional(),
  program_id: z.coerce.number().int().positive().optional(),
  batch_id: z.coerce.number().int().positive().optional(),
  section_id: z.coerce.number().int().positive().optional(),
  assignment_id: z.coerce.number().int().positive().optional(),
  component: z.enum(["IT1", "IT2", "IT3", "ASSIGNMENT"]).optional(),
  session_id: z.coerce.number().int().positive().optional(),
  term_id: z.coerce.number().int().positive().optional(),
  mappings: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      try {
        return JSON.parse(val) as Record<string, string>;
      } catch {
        return undefined;
      }
    }),
});

export const importExecuteSchema = z.object({
  entity_type: z.enum(["student", "faculty", "marks", "attendance", "timetable"]),
  department_id: z.coerce.number().int().positive().optional(),
  program_id: z.coerce.number().int().positive().optional(),
  batch_id: z.coerce.number().int().positive().optional(),
  section_id: z.coerce.number().int().positive().optional(),
  assignment_id: z.coerce.number().int().positive().optional(),
  component: z.enum(["IT1", "IT2", "IT3", "ASSIGNMENT"]).optional(),
  session_id: z.coerce.number().int().positive().optional(),
  term_id: z.coerce.number().int().positive().optional(),
  skip_errors: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => val === true || val === "true" || val === "1" || val === undefined),
  mappings: z.string().transform((val, ctx) => {
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Mappings must be an object of sourceColumn -> canonicalField",
        });
        return z.NEVER;
      }
      return parsed as Record<string, string>;
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid JSON format in mappings",
      });
      return z.NEVER;
    }
  }),
});

export const marksTemplateQuerySchema = z.object({
  assignment_id: z.coerce.number().int().positive(),
  component: z.enum(["IT1", "IT2", "IT3", "ASSIGNMENT"]),
});

export const attendanceTemplateQuerySchema = z.object({
  session_id: z.coerce.number().int().positive(),
});

