import { z } from "zod";

export const markEntrySchema = z.object({
  student_id: z.number().int().positive(),
  component: z.enum(["IT1", "IT2", "IT3", "ASSIGNMENT"]),
  marks_obtained: z.number().min(0),
});

export const bulkMarksSchema = z.object({
  subject_assignment_id: z.number().int().positive(),
  marks: z.array(markEntrySchema).min(1),
});
