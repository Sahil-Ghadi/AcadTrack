import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as mc from "../controllers/marks.controller";

const router = Router();

router.use(authenticate);

// Get marks table for a subject assignment (faculty and admins)
router.get("/assignments/:assignmentId", authorize("college_admin", "dept_admin", "faculty"), mc.getAssignmentMarks);

// Submit marks (faculty and admins)
router.post("/submit", authorize("college_admin", "dept_admin", "faculty"), mc.submitBulkMarks);

export default router;
