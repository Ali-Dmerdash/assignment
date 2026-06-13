import { Router } from "express";
import {
  listJobs,
  listMyJobs,
  getJob,
  createJob,
  updateJob,
  closeJob,
  listApplicants,
  downloadCv,
  decideApplication,
  ensureCanApply,
  applyToJob,
} from "../controllers/jobs.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { uploadCv, validateCv } from "../middleware/upload.js";
import { applyRateLimiter } from "../middleware/rateLimit.js";

const router: Router = Router();

router.get("/", authenticate, requireRole("applicant"), listJobs);

router.post(
  "/:id/apply",
  authenticate,
  requireRole("applicant"),
  applyRateLimiter,
  ensureCanApply,
  uploadCv,
  validateCv,
  applyToJob,
);

router.get("/mine", authenticate, requireRole("employer"), listMyJobs);

router.get("/:id", authenticate, getJob);
router.post("/", authenticate, requireRole("employer"), createJob);
router.put("/:id", authenticate, requireRole("employer"), updateJob);
router.patch("/:id/close", authenticate, requireRole("employer"), closeJob);
router.get(
  "/:id/applicants",
  authenticate,
  requireRole("employer"),
  listApplicants,
);
router.get(
  "/:id/applicants/:applicationId/cv",
  authenticate,
  requireRole("employer"),
  downloadCv,
);
router.patch(
  "/:id/applicants/:applicationId",
  authenticate,
  requireRole("employer"),
  decideApplication,
);

export default router;
