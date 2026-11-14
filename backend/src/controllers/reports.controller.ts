import type { Request, Response } from "express";
import * as reportsService from "../services/reports.service";
import { reportQuerySchema } from "../validators/reports.validator";

function collegeId(req: Request): number {
  return req.user!.collegeId;
}

// Student gets only their own data
export async function getMyReport(req: Request, res: Response) {
  const data = await reportsService.getStudentOwnReport(req.user!.id, collegeId(req));
  if (!data) {
    res.status(404).json({ message: "Student record not found" });
    return;
  }
  res.json(data);
}

// Assignment summary report (with optional below_threshold_only and CSV export)
export async function getAssignmentReport(req: Request, res: Response) {
  const parsed = reportQuerySchema.safeParse(req.query);
  if (!parsed.success) throw parsed.error;

  const assignmentId = Number(req.params.assignmentId);
  const data = await reportsService.getAssignmentReport(assignmentId, collegeId(req), {
    belowThresholdOnly: parsed.data.below_threshold_only,
  });

  if (!data) {
    res.status(404).json({ message: "Subject assignment not found" });
    return;
  }

  // If CSV requested
  if (parsed.data.format === "csv") {
    const headers = [
      "Roll No",
      "Full Name",
      "Total Lectures",
      "Present Count",
      "Attendance %",
      "Eligible",
      "IT1",
      "IT2",
      "IT3",
      "Assignment",
    ];

    const rows = data.students.map((s) => [
      s.roll_no,
      s.full_name,
      s.total_lectures,
      s.present_count,
      `${s.attendance_pct}%`,
      s.is_eligible ? "YES" : "NO",
      s.it1 ?? "",
      s.it2 ?? "",
      s.it3 ?? "",
      s.assignment ?? "",
    ]);

    const csvContent = reportsService.formatCsv(headers, rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${data.assignment.subject_code}_attendance_report.csv"`,
    );
    res.send(csvContent);
    return;
  }

  res.json(data);
}

// Class statistics with distribution and marks averages
export async function getClassStatistics(req: Request, res: Response) {
  const assignmentId = Number(req.params.assignmentId);
  const data = await reportsService.getClassStatistics(assignmentId, collegeId(req));
  if (!data) {
    res.status(404).json({ message: "Subject assignment not found" });
    return;
  }
  res.json(data);
}

// College / department analytics
export async function getAnalytics(req: Request, res: Response) {
  const deptId =
    req.user!.role === "dept_admin"
      ? req.user!.departmentId!
      : req.query.department_id
        ? Number(req.query.department_id)
        : undefined;

  const rows = await reportsService.getDepartmentAnalytics(collegeId(req), deptId);
  res.json(rows);
}
