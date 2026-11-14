import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as tc from "../controllers/timetable.controller";

const router = Router();

router.use(authenticate);

// --- Timetable Slots ---
router.get("/slots", authorize("college_admin", "dept_admin", "faculty", "student"), tc.listSlots);
router.post("/slots", authorize("college_admin", "dept_admin"), tc.createSlot);
router.delete("/slots/:id", authorize("college_admin", "dept_admin"), tc.deleteSlot);

// --- Lecture Sessions ---
router.get("/sessions", authorize("college_admin", "dept_admin", "faculty", "student"), tc.listLectureSessions);
router.post("/sessions/generate", authorize("college_admin", "dept_admin"), tc.generateLectureSessions);
router.patch("/sessions/:id/cancel", authorize("college_admin", "dept_admin", "faculty"), tc.cancelLectureSession);

export default router;
