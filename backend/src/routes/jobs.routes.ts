import { Router } from "express";
import {
  listJobs,
  createJob,
  updateJob,
  closeJob,
  listApplicants,
  ensureCanApply,
  applyToJob,
} from "../controllers/jobs.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { uploadCv, validateCv } from "../middleware/upload.js";

const router: Router = Router();

// Applicants browse published jobs.
router.get("/", authenticate, requireRole("applicant"), listJobs);

// Applicants apply once to a published job. ensureCanApply rejects duplicates /
// closed jobs BEFORE the CV is uploaded, so no file is processed for those.
router.post(
  "/:id/apply",
  authenticate,
  requireRole("applicant"),
  ensureCanApply,
  uploadCv,
  validateCv,
  applyToJob,
);

// Employers manage their own jobs.
router.post("/", authenticate, requireRole("employer"), createJob);
router.put("/:id", authenticate, requireRole("employer"), updateJob);
router.patch("/:id/close", authenticate, requireRole("employer"), closeJob);
router.get(
  "/:id/applicants",
  authenticate,
  requireRole("employer"),
  listApplicants,
);

export default router;
