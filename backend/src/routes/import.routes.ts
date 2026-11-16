import { Router } from "express";
import multer from "multer";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as ic from "../controllers/import.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max file size
  },
});

const router = Router();

router.use(authenticate);

// Preview and validate uploaded CSV
router.post(
  "/preview",
  authorize("college_admin", "dept_admin", "faculty"),
  upload.single("file"),
  ic.previewImport,
);

// Execute confirmed bulk import
router.post(
  "/execute",
  authorize("college_admin", "dept_admin", "faculty"),
  upload.single("file"),
  ic.executeImport,
);

// Download CSV templates
router.get(
  "/template/marks",
  authorize("college_admin", "dept_admin", "faculty"),
  ic.downloadMarksTemplate,
);

router.get(
  "/template/attendance",
  authorize("college_admin", "dept_admin", "faculty"),
  ic.downloadAttendanceTemplate,
);

router.get(
  "/template/timetable",
  authorize("college_admin", "dept_admin"),
  ic.downloadTimetableTemplate,
);

export default router;

