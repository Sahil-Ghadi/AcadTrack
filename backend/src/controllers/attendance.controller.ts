import type { Request, Response } from "express";
import * as attendanceService from "../services/attendance.service";
import { submitAttendanceSchema } from "../validators/attendance.validator";

function collegeId(req: Request): number {
  return req.user!.collegeId;
}

export async function getFacultyLectures(req: Request, res: Response) {
  const date = req.query.date as string | undefined;
  const isLocked = req.query.is_locked !== undefined ? req.query.is_locked === "true" : undefined;
  const rows = await attendanceService.getFacultyLectures(collegeId(req), req.user!.id, {
    date,
    isLocked,
  });
  res.json(rows);
}

export async function getSessionStudents(req: Request, res: Response) {
  const data = await attendanceService.getSessionStudents(
    Number(req.params.sessionId),
    collegeId(req),
  );
  if (!data) {
    res.status(404).json({ message: "Lecture session not found" });
    return;
  }
  res.json(data);
}

export async function submitAttendance(req: Request, res: Response) {
  const parsed = submitAttendanceSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;

  const result = await attendanceService.submitAttendance(
    Number(req.params.sessionId),
    collegeId(req),
    req.user!.id,
    req.user!.role,
    parsed.data.records,
    parsed.data.lock,
  );
  res.json(result);
}

export async function lockSession(req: Request, res: Response) {
  const row = await attendanceService.lockSession(
    Number(req.params.sessionId),
    collegeId(req),
    req.user!.id,
    req.user!.role,
  );
  res.json({ message: "Lecture session locked successfully", session: row });
}
