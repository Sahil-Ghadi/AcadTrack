import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as rc from "../controllers/reports.controller";

const router = Router();

router.use(authenticate);

// Student own report (Student only)
router.get("/my-report", authorize("student"), rc.getMyReport);

// Assignment summary report & CSV export (Faculty, Dept Admin, College Admin)
router.get("/assignments/:assignmentId", authorize("college_admin", "dept_admin", "faculty"), rc.getAssignmentReport);

// Class statistics & chart data (Faculty, Dept Admin, College Admin)
router.get("/assignments/:assignmentId/stats", authorize("college_admin", "dept_admin", "faculty"), rc.getClassStatistics);

// College / department analytics (Dept Admin, College Admin)
router.get("/analytics", authorize("college_admin", "dept_admin"), rc.getAnalytics);

export default router;
