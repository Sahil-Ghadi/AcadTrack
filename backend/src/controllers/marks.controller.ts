import type { Request, Response } from "express";
import * as marksService from "../services/marks.service";
import { bulkMarksSchema } from "../validators/marks.validator";

function collegeId(req: Request): number {
  return req.user!.collegeId;
}

export async function getAssignmentMarks(req: Request, res: Response) {
  const data = await marksService.getAssignmentMarks(
    Number(req.params.assignmentId),
    collegeId(req),
  );
  if (!data) {
    res.status(404).json({ message: "Subject assignment not found" });
    return;
  }
  res.json(data);
}

export async function submitBulkMarks(req: Request, res: Response) {
  const parsed = bulkMarksSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;

  const result = await marksService.submitBulkMarks(
    parsed.data.subject_assignment_id,
    collegeId(req),
    req.user!.id,
    req.user!.role,
    parsed.data.marks,
  );
  res.json(result);
}
