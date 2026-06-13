import { Router } from "express";
import {
  listJobs,
  createJob,
  updateJob,
  closeJob,
  listApplicants,
  applyToJob,
} from "../controllers/jobs.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { uploadCv, validateCv } from "../middleware/upload.js";

const router: Router = Router();

// Applicants browse published jobs.
router.get("/", authenticate, requireRole("applicant"), listJobs);

// Applicants apply once to a published job (CV uploaded + validated first).
router.post(
  "/:id/apply",
  authenticate,
  requireRole("applicant"),
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
