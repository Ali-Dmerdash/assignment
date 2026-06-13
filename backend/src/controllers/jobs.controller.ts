import { unlink } from "node:fs/promises";
import type { RequestHandler, Request, Response } from "express";
import type { QueryFilter } from "mongoose";
import { Job, type IJob, type JobDocument } from "../models/Job.js";
import { Application } from "../models/Application.js";
import { User, type UserRole } from "../models/User.js";
import type { AuthUser } from "../middleware/auth.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// Statuses an employer may set via create/edit; closing is a separate endpoint.
const EDITABLE_STATUSES = ["draft", "published"] as const;

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePositiveInt(
  value: unknown,
  fallback: number,
  max?: number,
): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return max ? Math.min(n, max) : n;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

function requireRole(
  req: Request,
  res: Response,
  role: UserRole,
): AuthUser | null {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (req.user.role !== role) {
    res.status(403).json({ error: `Only ${role}s can perform this action` });
    return null;
  }
  return req.user;
}

function requireEmployer(req: Request, res: Response): AuthUser | null {
  return requireRole(req, res, "employer");
}

function requireApplicant(req: Request, res: Response): AuthUser | null {
  return requireRole(req, res, "applicant");
}

async function loadOwnedJob(
  jobId: string,
  userId: string,
  res: Response,
): Promise<JobDocument | null> {
  const job = await Job.findById(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return null;
  }
  if (job.employer.toString() !== userId) {
    res.status(403).json({ error: "You do not own this job" });
    return null;
  }
  return job;
}

/**
 * GET /api/jobs?page=&limit=&location=&keyword=  (applicant)
 */
export const listJobs: RequestHandler = async (req, res, next) => {
  try {
    const user = requireApplicant(req, res);
    if (!user) return;

    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    const limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);

    const filter: QueryFilter<IJob> = { status: "published" };

    const location = readString(req.query.location);
    if (location) {
      filter.location = new RegExp(escapeRegex(location), "i");
    }

    const keyword = readString(req.query.keyword);
    if (keyword) {
      const rx = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [{ title: rx }, { description: rx }];
    }

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .sort({ datePosted: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Job.countDocuments(filter),
    ]);

    res.json({ data: jobs, total, page, limit });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/jobs  (employer) — create a job they own.
 */
export const createJob: RequestHandler = async (req, res, next) => {
  try {
    const user = requireEmployer(req, res);
    if (!user) return;

    const { title, company, description, location, salary, status } =
      req.body ?? {};

    if (!title || !company || !description) {
      res
        .status(400)
        .json({ error: "title, company and description are required" });
      return;
    }

    const initialStatus = status ?? "draft";
    if (!EDITABLE_STATUSES.includes(initialStatus)) {
      res
        .status(400)
        .json({ error: "status must be 'draft' or 'published' on create" });
      return;
    }

    // employer comes from the token — never trusted from the body.
    const job = await Job.create({
      title,
      company,
      description,
      location,
      salary,
      status: initialStatus,
      employer: user.id,
    });
    res.status(201).json({ job });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/jobs/:id  (employer, own job) — edit content / publish a draft.
 */
export const updateJob: RequestHandler<{ id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const user = requireEmployer(req, res);
    if (!user) return;

    const job = await loadOwnedJob(req.params.id, user.id, res);
    if (!job) return;

    const { title, company, description, location, salary, status } =
      req.body ?? {};

    if (title !== undefined) job.title = title;
    if (company !== undefined) job.company = company;
    if (description !== undefined) job.description = description;
    if (location !== undefined) job.location = location;
    if (salary !== undefined) job.salary = salary;
    if (status !== undefined) {
      if (!EDITABLE_STATUSES.includes(status)) {
        res
          .status(400)
          .json({ error: "status can only be 'draft' or 'published' here" });
        return;
      }
      job.status = status;
    }

    await job.save();
    res.json({ job });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/jobs/:id/close  (employer, own job) — close; never deletes.
 */
export const closeJob: RequestHandler<{ id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const user = requireEmployer(req, res);
    if (!user) return;

    const job = await loadOwnedJob(req.params.id, user.id, res);
    if (!job) return;

    job.status = "closed";
    await job.save();
    res.json({ job });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/jobs/:id/applicants  (employer, own job) — view applicants.
 */
export const listApplicants: RequestHandler<{ id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const user = requireEmployer(req, res);
    if (!user) return;

    const job = await loadOwnedJob(req.params.id, user.id, res);
    if (!job) return;

    const applications = await Application.find({ job: job._id })
      .populate("applicant", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ data: applications, total: applications.length });
  } catch (err) {
    next(err);
  }
};

/**
 * Pre-upload gate for POST /api/jobs/:id/apply.
 */
export const ensureCanApply: RequestHandler<{ id: string }> = async (
  req,
  res,
  next,
) => {
  try {
    const user = requireApplicant(req, res);
    if (!user) return;

    const job = await Job.findById(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    if (job.status !== "published") {
      res.status(403).json({ error: "This job is not open for applications" });
      return;
    }
    if (await Application.exists({ job: job._id, applicant: user.id })) {
      res.status(409).json({ error: "You have already applied to this job" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/jobs/:id/apply  (applicant) — apply once to a published job.
 */
export const applyToJob: RequestHandler<{ id: string }> = async (
  req,
  res,
  next,
) => {
  // The CV was already written to disk by validateCv. If we don't end up
  // creating the application (wrong role, non-published job, duplicate, error),
  // remove that file so failed applies don't leave orphaned uploads.
  let created = false;
  try {
    const user = requireApplicant(req, res);
    if (!user) return;

    if (!req.cvFile) {
      res.status(400).json({ error: "A CV file is required" });
      return;
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    // Only published jobs accept applications — enforced server-side.
    if (job.status !== "published") {
      res.status(403).json({ error: "This job is not open for applications" });
      return;
    }

    // Name/email come from the applicant's profile, not the client.
    const applicant = await User.findById(user.id);
    if (!applicant) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const coverNote =
      typeof req.body?.coverNote === "string"
        ? req.body.coverNote.trim()
        : undefined;

    const application = await Application.create({
      job: job._id,
      applicant: applicant._id,
      name: applicant.name,
      email: applicant.email,
      coverNote,
      cv: req.cvFile,
    });
    created = true;

    // TODO: emit "new_application" to the owning employer's room once Socket.io
    // is wired in server.ts (room keyed by job.employer).

    res.status(201).json({ application });
  } catch (err) {
    // Unique {job, applicant} index → this applicant already applied here.
    if (isDuplicateKeyError(err)) {
      res.status(409).json({ error: "You have already applied to this job" });
      return;
    }
    next(err);
  } finally {
    if (!created && req.cvFile) {
      await unlink(req.cvFile.path).catch(() => {});
    }
  }
};
