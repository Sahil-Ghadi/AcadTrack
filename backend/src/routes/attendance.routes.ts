import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as atc from "../controllers/attendance.controller";

const router = Router();

router.use(authenticate);

// Faculty: today's lectures list
router.get("/my-lectures", authorize("faculty"), atc.getFacultyLectures);

// Get students for a lecture session (faculty and admins)
router.get("/sessions/:sessionId/students", authorize("college_admin", "dept_admin", "faculty"), atc.getSessionStudents);

// Submit attendance (faculty and admins)
router.post("/sessions/:sessionId/submit", authorize("college_admin", "dept_admin", "faculty"), atc.submitAttendance);

// Lock session
router.post("/sessions/:sessionId/lock", authorize("college_admin", "dept_admin", "faculty"), atc.lockSession);

export default router;
