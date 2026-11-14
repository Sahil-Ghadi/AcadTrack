import type { Request, Response } from "express";
import * as timetableService from "../services/timetable.service";
import {
  createTimetableSlotSchema,
  updateTimetableSlotSchema,
  generateSessionsSchema,
} from "../validators/timetable.validator";

function collegeId(req: Request): number {
  return req.user!.collegeId;
}

function scopedDeptId(req: Request): number | undefined {
  if (req.user!.role === "dept_admin") return req.user!.departmentId!;
  return undefined;
}

// ======================== TIMETABLE SLOTS ========================

export async function listSlots(req: Request, res: Response) {
  let deptId: number | undefined;
  if (req.user!.role === "dept_admin") {
    deptId = req.user!.departmentId!;
    if (req.query.department_id && Number(req.query.department_id) !== deptId) {
      res.status(403).json({ message: "Department admins can only view slots for their own department" });
      return;
    }
  } else if (req.query.department_id) {
    deptId = Number(req.query.department_id);
  }

  const termId = req.query.term_id ? Number(req.query.term_id) : undefined;
  const facultyId = req.query.faculty_id ? Number(req.query.faculty_id) : undefined;
  const sectionId = req.query.section_id ? Number(req.query.section_id) : undefined;
  const dayOfWeek = req.query.day_of_week ? Number(req.query.day_of_week) : undefined;

  // If faculty role is requesting without specifying faculty_id, we can scope to their own user_id
  const userId = req.user!.role === "faculty" && !facultyId ? req.user!.id : undefined;

  const rows = await timetableService.listSlots(collegeId(req), {
    termId,
    departmentId: deptId,
    facultyId,
    userId,
    sectionId,
    dayOfWeek,
  });
  res.json(rows);
}

export async function exportSlotsCsv(req: Request, res: Response) {
  let deptId: number | undefined;

  if (req.user!.role === "dept_admin") {
    deptId = req.user!.departmentId!;
    if (req.query.department_id && Number(req.query.department_id) !== deptId) {
      res.status(403).json({ message: "Department admins can only export timetable for their own department" });
      return;
    }
  } else if (req.query.department_id) {
    deptId = Number(req.query.department_id);
  }

  const termId = req.query.term_id ? Number(req.query.term_id) : undefined;

  const csv = await timetableService.exportSlotsCsv(collegeId(req), {
    departmentId: deptId,
    termId,
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="timetable_export.csv"');
  res.status(200).send(csv);
}

export async function createSlot(req: Request, res: Response) {
  const parsed = createTimetableSlotSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await timetableService.createSlot(collegeId(req), parsed.data, scopedDeptId(req));
  res.status(201).json(row);
}

export async function updateSlot(req: Request, res: Response) {
  const parsed = updateTimetableSlotSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await timetableService.updateSlot(
    Number(req.params.id),
    collegeId(req),
    parsed.data,
    scopedDeptId(req),
  );
  res.json(row);
}

export async function deleteSlot(req: Request, res: Response) {
  const success = await timetableService.deleteSlot(
    Number(req.params.id),
    collegeId(req),
    scopedDeptId(req),
  );
  if (!success) {
    res.status(404).json({ message: "Timetable slot not found" });
    return;
  }
  res.json({ message: "Slot deleted successfully" });
}

// ======================== LECTURE SESSIONS ========================

export async function listLectureSessions(req: Request, res: Response) {
  const startDate = req.query.start_date as string | undefined;
  const endDate = req.query.end_date as string | undefined;
  const date = req.query.date as string | undefined;
  const facultyId = req.query.faculty_id ? Number(req.query.faculty_id) : undefined;
  const sectionId = req.query.section_id ? Number(req.query.section_id) : undefined;
  const status = req.query.status as string | undefined;
  const isLocked = req.query.is_locked !== undefined ? req.query.is_locked === "true" : undefined;
  const subjectAssignmentId = req.query.subject_assignment_id
    ? Number(req.query.subject_assignment_id)
    : undefined;

  const userId = req.user!.role === "faculty" && !facultyId ? req.user!.id : undefined;

  const rows = await timetableService.listLectureSessions(collegeId(req), {
    startDate,
    endDate,
    date,
    facultyId,
    userId,
    sectionId,
    status,
    isLocked,
    subjectAssignmentId,
  });
  res.json(rows);
}

export async function generateLectureSessions(req: Request, res: Response) {
  const parsed = generateSessionsSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const rows = await timetableService.generateLectureSessions(collegeId(req), parsed.data);
  res.status(201).json({
    message: `Generated ${rows.length} lecture session(s)`,
    count: rows.length,
    sessions: rows,
  });
}

export async function cancelLectureSession(req: Request, res: Response) {
  const row = await timetableService.cancelLectureSession(Number(req.params.id), collegeId(req));
  if (!row) {
    res.status(404).json({ message: "Lecture session not found" });
    return;
  }
  res.json(row);
}
