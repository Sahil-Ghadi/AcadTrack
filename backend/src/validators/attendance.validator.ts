import { z } from "zod";

export const attendanceRecordSchema = z.object({
  student_id: z.number().int().positive(),
  status: z.enum(["present", "absent"]),
});

export const submitAttendanceSchema = z.object({
  records: z.array(attendanceRecordSchema).min(1),
  lock: z.boolean().default(false),
});
