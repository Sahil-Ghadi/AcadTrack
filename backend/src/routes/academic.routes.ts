import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as ac from "../controllers/academic.controller";

const router = Router();

router.use(authenticate);

// --- Students ---
router.get("/students", authorize("college_admin", "dept_admin", "faculty"), ac.listStudents);
router.post("/students", authorize("college_admin", "dept_admin"), ac.createStudent);

// --- Faculty ---
router.get("/faculty", authorize("college_admin", "dept_admin"), ac.listFaculty);
router.post("/faculty", authorize("college_admin", "dept_admin"), ac.createFaculty);

// --- User Status (deactivate / reactivate) ---
router.patch("/users/:id/status", authorize("college_admin", "dept_admin"), ac.setUserStatus);

// --- Subjects ---
router.get("/subjects", authorize("college_admin", "dept_admin", "faculty"), ac.listSubjects);
router.post("/subjects", authorize("college_admin", "dept_admin"), ac.createSubject);
router.patch("/subjects/:id", authorize("college_admin", "dept_admin"), ac.updateSubject);

// --- Subject Assignments ---
router.get("/assignments", authorize("college_admin", "dept_admin", "faculty"), ac.listSubjectAssignments);
router.post("/assignments", authorize("college_admin", "dept_admin"), ac.createSubjectAssignment);

// --- Elective Enrollment ---
router.get("/electives", authorize("college_admin", "dept_admin", "faculty"), ac.listElectiveEnrollments);
router.post("/electives", authorize("college_admin", "dept_admin"), ac.enrollElective);
router.post("/electives/bulk", authorize("college_admin", "dept_admin"), ac.bulkEnrollElective);

export default router;
