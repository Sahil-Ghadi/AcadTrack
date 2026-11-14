import { z } from "zod";

export const createTimetableSlotSchema = z.object({
  subject_assignment_id: z.number().int().positive(),
  day_of_week: z.number().int().min(1).max(6), // 1 = Monday, 6 = Saturday
  period_no: z.number().int().min(1).max(12),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "HH:MM format required"),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "HH:MM format required"),
  room: z.string().min(1).max(20),
});

export const generateSessionsSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format required"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format required"),
  term_id: z.number().int().positive().optional(),
  slot_id: z.number().int().positive().optional(),
});

export const cancelSessionSchema = z.object({
  status: z.literal("cancelled"),
});
