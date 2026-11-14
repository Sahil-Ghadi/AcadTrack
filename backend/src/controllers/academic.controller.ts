import type { Request, Response } from "express";
import * as academicService from "../services/academic.service";
import {
  createStudentUserSchema,
  createFacultyUserSchema,
  deactivateUserSchema,
  createSubjectSchema,
  updateSubjectSchema,
  createSubjectAssignmentSchema,
  createElectiveEnrollmentSchema,
  bulkElectiveEnrollmentSchema,
} from "../validators/academic.validator";

function collegeId(req: Request): number {
  return req.user!.collegeId;
}

function scopedDeptId(req: Request): number | undefined {
  if (req.user!.role === "dept_admin") return req.user!.departmentId!;
  return undefined;
}

// ======================== STUDENTS ========================

export async function listStudents(req: Request, res: Response) {
  const deptId = req.query.department_id ? Number(req.query.department_id) : scopedDeptId(req);
  const sectionId = req.query.section_id ? Number(req.query.section_id) : undefined;
  const rows = await academicService.listStudents(collegeId(req), {
    departmentId: deptId,
    sectionId,
  });
  res.json(rows);
}

export async function createStudent(req: Request, res: Response) {
  const parsed = createStudentUserSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await academicService.createStudent(collegeId(req), parsed.data, scopedDeptId(req));
  res.status(201).json(row);
}

// ======================== FACULTY ========================

export async function listFaculty(req: Request, res: Response) {
  const deptId = req.query.department_id ? Number(req.query.department_id) : scopedDeptId(req);
  const rows = await academicService.listFaculty(collegeId(req), deptId);
  res.json(rows);
}

export async function createFaculty(req: Request, res: Response) {
  const parsed = createFacultyUserSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;

  // dept_admin can only add faculty to their own department
  if (req.user!.role === "dept_admin" && parsed.data.department_id !== req.user!.departmentId) {
    res.status(403).json({ message: "Forbidden: can only create faculty in your own department" });
    return;
  }

  const row = await academicService.createFaculty(collegeId(req), parsed.data);
  res.status(201).json(row);
}

// ======================== USER DEACTIVATION ========================

export async function setUserStatus(req: Request, res: Response) {
  const parsed = deactivateUserSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await academicService.setUserActiveStatus(
    Number(req.params.id),
    collegeId(req),
    parsed.data.is_active,
  );
  if (!row) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  res.json(row);
}

// ======================== SUBJECTS ========================

export async function listSubjects(req: Request, res: Response) {
  const deptId = req.query.department_id ? Number(req.query.department_id) : scopedDeptId(req);
  const semester = req.query.semester ? Number(req.query.semester) : undefined;
  const rows = await academicService.listSubjects(collegeId(req), {
    departmentId: deptId,
    semester,
  });
  res.json(rows);
}

export async function createSubject(req: Request, res: Response) {
  const parsed = createSubjectSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;

  if (req.user!.role === "dept_admin" && parsed.data.department_id !== req.user!.departmentId) {
    res.status(403).json({ message: "Forbidden: can only create subjects in your own department" });
    return;
  }

  const row = await academicService.createSubject(collegeId(req), parsed.data);
  res.status(201).json(row);
}

export async function updateSubject(req: Request, res: Response) {
  const parsed = updateSubjectSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await academicService.updateSubject(
    Number(req.params.id),
    collegeId(req),
    parsed.data,
  );
  if (!row) {
    res.status(404).json({ message: "Subject not found" });
    return;
  }
  res.json(row);
}

// ======================== SUBJECT ASSIGNMENTS ========================

export async function listSubjectAssignments(req: Request, res: Response) {
  const deptId = req.query.department_id ? Number(req.query.department_id) : scopedDeptId(req);
  const termId = req.query.term_id ? Number(req.query.term_id) : undefined;
  const facultyId = req.query.faculty_id ? Number(req.query.faculty_id) : undefined;
  const sectionId = req.query.section_id ? Number(req.query.section_id) : undefined;

  const rows = await academicService.listSubjectAssignments(collegeId(req), {
    departmentId: deptId,
    termId,
    facultyId,
    sectionId,
  });
  res.json(rows);
}

export async function createSubjectAssignment(req: Request, res: Response) {
  const parsed = createSubjectAssignmentSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await academicService.createSubjectAssignment(
    collegeId(req),
    parsed.data,
    scopedDeptId(req),
  );
  res.status(201).json(row);
}

// ======================== ELECTIVE ENROLLMENT ========================

export async function listElectiveEnrollments(req: Request, res: Response) {
  const subjectId = req.query.subject_id ? Number(req.query.subject_id) : undefined;
  const termId = req.query.term_id ? Number(req.query.term_id) : undefined;
  const studentId = req.query.student_id ? Number(req.query.student_id) : undefined;

  const rows = await academicService.listElectiveEnrollments(collegeId(req), {
    subjectId,
    termId,
    studentId,
  });
  res.json(rows);
}

export async function enrollElective(req: Request, res: Response) {
  const parsed = createElectiveEnrollmentSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const row = await academicService.enrollElective(parsed.data);
  res.status(201).json(row);
}

export async function bulkEnrollElective(req: Request, res: Response) {
  const parsed = bulkElectiveEnrollmentSchema.safeParse(req.body);
  if (!parsed.success) throw parsed.error;
  const rows = await academicService.bulkEnrollElective(parsed.data);
  res.status(201).json(rows);
}
