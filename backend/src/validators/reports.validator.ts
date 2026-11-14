import { z } from "zod";

export const reportQuerySchema = z.object({
  term_id: z.coerce.number().int().positive().optional(),
  department_id: z.coerce.number().int().positive().optional(),
  subject_assignment_id: z.coerce.number().int().positive().optional(),
  section_id: z.coerce.number().int().positive().optional(),
  below_threshold_only: z.coerce.boolean().optional(),
  format: z.enum(["json", "csv"]).default("json"),
});
