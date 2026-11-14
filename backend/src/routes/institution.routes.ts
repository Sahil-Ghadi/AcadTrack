import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/auth.middleware";
import * as ic from "../controllers/institution.controller";

const router = Router();

// All institution routes require authentication
router.use(authenticate);

// --- Departments (college_admin only for write; all admins can read) ---
router.get("/departments", authorize("college_admin", "dept_admin"), ic.listDepartments);
router.get("/departments/:id", authorize("college_admin", "dept_admin"), ic.getDepartment);
router.post("/departments", authorize("college_admin"), ic.createDepartment);
router.patch("/departments/:id", authorize("college_admin"), ic.updateDepartment);

// --- Programs ---
router.get("/programs", authorize("college_admin", "dept_admin"), ic.listPrograms);
router.get("/programs/:id", authorize("college_admin", "dept_admin"), ic.getProgram);
router.post("/programs", authorize("college_admin", "dept_admin"), ic.createProgram);
router.patch("/programs/:id", authorize("college_admin", "dept_admin"), ic.updateProgram);

// --- Batches ---
router.get("/batches", authorize("college_admin", "dept_admin"), ic.listBatches);
router.post("/batches", authorize("college_admin", "dept_admin"), ic.createBatch);
router.patch("/batches/:id", authorize("college_admin", "dept_admin"), ic.updateBatch);

// --- Sections ---
router.get("/sections", authorize("college_admin", "dept_admin"), ic.listSections);
router.post("/sections", authorize("college_admin", "dept_admin"), ic.createSection);

// --- Lab Groups ---
router.get("/lab-groups", authorize("college_admin", "dept_admin"), ic.listLabGroups);
router.post("/lab-groups", authorize("college_admin", "dept_admin"), ic.createLabGroup);

// --- Academic Terms (college_admin only) ---
router.get("/academic-terms", authorize("college_admin", "dept_admin"), ic.listAcademicTerms);
router.get("/academic-terms/current", authorize("college_admin", "dept_admin", "faculty", "student"), ic.getCurrentTerm);
router.post("/academic-terms", authorize("college_admin"), ic.createAcademicTerm);
router.patch("/academic-terms/:id", authorize("college_admin"), ic.updateAcademicTerm);

// --- Settings (college_admin only) ---
router.get("/settings", authorize("college_admin"), ic.getSettings);
router.put("/settings", authorize("college_admin"), ic.updateSettings);

export default router;

