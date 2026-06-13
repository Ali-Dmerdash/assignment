import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import mongoose from "mongoose";
import {
  createJob,
  updateJob,
  closeJob,
  listApplicants,
  ensureCanApply,
  applyToJob,
  listJobs,
} from "../src/controllers/jobs.controller.js";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { User, type UserRole } from "../src/models/User.js";
import { Job } from "../src/models/Job.js";
import { Application } from "../src/models/Application.js";
import { validateCv } from "../src/middleware/upload.js";
import {
  connectTestDb,
  clearTestDb,
  disconnectTestDb,
  mockReq,
  mockRes,
  throwingNext as next,
} from "./helpers.js";

// Real CV files (and an image masquerading as a CV) live here.
const FIXTURES_DIR = "test/fixtures";
// Matches UPLOAD_DIR in test/setup.ts — where validateCv writes accepted files.
const UPLOAD_TMP = "test/uploads-tmp";

/**
 * Runs the real upload pipeline for a fixture file — validateCv sniffs the
 * content, writes accepted files to disk and sets req.cvFile — then applyToJob.
 * Returns both responses; applyRes is null when validation rejected the file.
 */
async function submitApplication(
  applicantId: string,
  jobId: string,
  fixture: string,
  coverNote?: string,
) {
  const req = mockReq({
    user: { id: applicantId, role: "applicant" },
    params: { id: jobId },
    body: coverNote ? { coverNote } : {},
  });

  // Mirror the route order: ensureCanApply runs BEFORE the upload, so a closed
  // job or duplicate is rejected without the file ever being processed.
  const preRes = mockRes();
  await ensureCanApply(req, preRes, next);
  if (preRes.statusCode >= 400) {
    return { preRes, validateRes: null, applyRes: null };
  }

  const buffer = readFileSync(join(FIXTURES_DIR, fixture));
  req.file = { buffer, originalname: fixture, size: buffer.length };

  const validateRes = mockRes();
  await validateCv(req, validateRes, next);
  if (validateRes.statusCode === 400) {
    return { preRes, validateRes, applyRes: null };
  }
  const applyRes = mockRes();
  await applyToJob(req, applyRes, next);
  return { preRes, validateRes, applyRes };
}

let userSeq = 0;
async function makeUser(role: UserRole) {
  userSeq += 1;
  return User.create({
    name: `Test ${role} ${userSeq}`,
    email: `${role}-${userSeq}@example.com`,
    password: "hashed-password-placeholder",
    role,
  });
}

async function makeJob(
  employerId: string,
  overrides: Record<string, unknown> = {},
) {
  return Job.create({
    title: "Backend Engineer",
    company: "Acme",
    description: "Build APIs with Node and TypeScript",
    status: "published",
    employer: employerId,
    ...overrides,
  });
}

beforeAll(async () => {
  await connectTestDb();
  // Ensure the unique {job, applicant} index exists for the dedup test.
  await Application.syncIndexes();
  // Clear ONCE at the start of the run (not between tests). Each test uses its
  // own employer/job (unique via userSeq) and scopes its assertions, so data
  // accumulates and persists afterward for inspection while staying deterministic.
  await clearTestDb();
  await rm(UPLOAD_TMP, { recursive: true, force: true });
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("createJob", () => {
  it("creates a published job owned by the employer (201) and stamps datePosted", async () => {
    const emp = await makeUser("employer");
    const req = mockReq({
      user: { id: emp.id, role: "employer" },
      body: {
        title: "Dev",
        company: "Acme",
        description: "Build things",
        status: "published",
      },
    });
    const res = mockRes();

    await createJob(req, res, next);

    expect(res.statusCode).toBe(201);
    const jobs = await Job.find({ employer: emp.id });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.employer.toString()).toBe(emp.id);
    expect(jobs[0]!.status).toBe("published");
    expect(jobs[0]!.datePosted).toBeInstanceOf(Date);
  });

  it("rejects missing required fields (400)", async () => {
    const emp = await makeUser("employer");
    const req = mockReq({
      user: { id: emp.id, role: "employer" },
      body: { title: "Dev" },
    });
    const res = mockRes();

    await createJob(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(await Job.countDocuments({ employer: emp.id })).toBe(0);
  });

  it("forbids non-employers (403)", async () => {
    const applicant = await makeUser("applicant");
    const req = mockReq({
      user: { id: applicant.id, role: "applicant" },
      body: { title: "Dev", company: "Acme", description: "..." },
    });
    const res = mockRes();

    await createJob(req, res, next);

    expect(res.statusCode).toBe(403);
  });
});

describe("listJobs", () => {
  it("returns only published jobs with a total count", async () => {
    const emp = await makeUser("employer");
    const applicant = await makeUser("applicant");
    // Unique tag so the count is deterministic regardless of accumulated data.
    const tag = "ONLYPUBLISHEDTAG";
    await makeJob(emp.id, { title: `React Dev ${tag}`, status: "published" });
    await makeJob(emp.id, { title: `Node Dev ${tag}`, status: "published" });
    await makeJob(emp.id, { title: `Draft ${tag}`, status: "draft" });

    const req = mockReq({
      user: { id: applicant.id, role: "applicant" },
      query: { keyword: tag },
    });
    const res = mockRes();

    await listJobs(req, res, next);

    expect(res.statusCode).toBe(200);
    const body = res.body as { total: number; data: unknown[] };
    expect(body.total).toBe(2); // draft excluded
    expect(body.data).toHaveLength(2);
  });

  it("filters by keyword across title and description", async () => {
    const emp = await makeUser("employer");
    const applicant = await makeUser("applicant");
    const tag = "KEYWORDMATCHTAG";
    await makeJob(emp.id, { title: `React Dev ${tag}` }); // title match
    await makeJob(emp.id, { title: "Node Dev", description: `backend ${tag}` }); // description match
    await makeJob(emp.id, { title: "Designer", description: "figma" }); // no match

    const req = mockReq({
      user: { id: applicant.id, role: "applicant" },
      query: { keyword: tag },
    });
    const res = mockRes();

    await listJobs(req, res, next);

    const body = res.body as { total: number };
    expect(body.total).toBe(2); // title match + description match
  });

  it("forbids non-applicants (403)", async () => {
    const emp = await makeUser("employer");
    const req = mockReq({ user: { id: emp.id, role: "employer" }, query: {} });
    const res = mockRes();

    await listJobs(req, res, next);

    expect(res.statusCode).toBe(403);
  });
});

describe("updateJob", () => {
  it("lets the owner edit their job (200)", async () => {
    const emp = await makeUser("employer");
    const job = await makeJob(emp.id, { title: "Old", status: "draft" });
    const req = mockReq({
      user: { id: emp.id, role: "employer" },
      params: { id: job.id },
      body: { title: "New title" },
    });
    const res = mockRes();

    await updateJob(req, res, next);

    expect(res.statusCode).toBe(200);
    expect((await Job.findById(job.id))!.title).toBe("New title");
  });

  it("forbids editing another employer's job (403)", async () => {
    const owner = await makeUser("employer");
    const other = await makeUser("employer");
    const job = await makeJob(owner.id);
    const req = mockReq({
      user: { id: other.id, role: "employer" },
      params: { id: job.id },
      body: { title: "Hijacked" },
    });
    const res = mockRes();

    await updateJob(req, res, next);

    expect(res.statusCode).toBe(403);
  });

  it("404 when the job does not exist", async () => {
    const emp = await makeUser("employer");
    const req = mockReq({
      user: { id: emp.id, role: "employer" },
      params: { id: new mongoose.Types.ObjectId().toString() },
      body: { title: "x" },
    });
    const res = mockRes();

    await updateJob(req, res, next);

    expect(res.statusCode).toBe(404);
  });
});

describe("closeJob", () => {
  it("lets the owner close their job", async () => {
    const emp = await makeUser("employer");
    const job = await makeJob(emp.id, { status: "published" });
    const req = mockReq({
      user: { id: emp.id, role: "employer" },
      params: { id: job.id },
    });
    const res = mockRes();

    await closeJob(req, res, next);

    expect(res.statusCode).toBe(200);
    expect((await Job.findById(job.id))!.status).toBe("closed");
  });

  it("forbids closing another employer's job (403)", async () => {
    const owner = await makeUser("employer");
    const other = await makeUser("employer");
    const job = await makeJob(owner.id);
    const req = mockReq({
      user: { id: other.id, role: "employer" },
      params: { id: job.id },
    });
    const res = mockRes();

    await closeJob(req, res, next);

    expect(res.statusCode).toBe(403);
  });
});

describe("listApplicants", () => {
  it("returns the owner's applicants with applicant details populated", async () => {
    const emp = await makeUser("employer");
    const applicant = await makeUser("applicant");
    const job = await makeJob(emp.id);
    await submitApplication(applicant.id, job.id, "pdf-to-pdf.pdf");

    const req = mockReq({
      user: { id: emp.id, role: "employer" },
      params: { id: job.id },
    });
    const res = mockRes();

    await listApplicants(req, res, next);

    expect(res.statusCode).toBe(200);
    const body = res.body as {
      total: number;
      data: Array<{ applicant: { email: string } }>;
    };
    expect(body.total).toBe(1);
    expect(body.data[0]!.applicant.email).toBe(applicant.email);
  });

  it("forbids viewing applicants for another employer's job (403)", async () => {
    const owner = await makeUser("employer");
    const other = await makeUser("employer");
    const job = await makeJob(owner.id);
    const req = mockReq({
      user: { id: other.id, role: "employer" },
      params: { id: job.id },
    });
    const res = mockRes();

    await listApplicants(req, res, next);

    expect(res.statusCode).toBe(403);
  });
});

describe("applyToJob", () => {
  it("accepts a real PDF and stores the application (201)", async () => {
    const emp = await makeUser("employer");
    const applicant = await makeUser("applicant");
    const job = await makeJob(emp.id, { status: "published" });

    const { validateRes, applyRes } = await submitApplication(
      applicant.id,
      job.id,
      "pdf-to-pdf.pdf",
      "Keen to apply",
    );

    expect(validateRes!.statusCode).not.toBe(400);
    expect(applyRes!.statusCode).toBe(201);
    const app = await Application.findOne({ job: job.id });
    expect(app!.cv.mimeType).toBe("application/pdf");
    expect(app!.coverNote).toBe("Keen to apply");
    expect(app!.email).toBe(applicant.email);
  });

  it.each([
    ["doc-to-doc.doc", "application/msword"],
    [
      "docx-to-docx.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  ])("accepts a real %s (201)", async (fixture, expectedMime) => {
    const emp = await makeUser("employer");
    const applicant = await makeUser("applicant");
    const job = await makeJob(emp.id, { status: "published" });

    const { applyRes } = await submitApplication(applicant.id, job.id, fixture);

    expect(applyRes!.statusCode).toBe(201);
    expect((await Application.findOne({ job: job.id }))!.cv.mimeType).toBe(
      expectedMime,
    );
  });

  it("rejects a non-CV file (image renamed .pdf) before applying (400)", async () => {
    const emp = await makeUser("employer");
    const applicant = await makeUser("applicant");
    const job = await makeJob(emp.id, { status: "published" });

    const { validateRes, applyRes } = await submitApplication(
      applicant.id,
      job.id,
      "image-to-pdf.pdf",
    );

    expect(validateRes!.statusCode).toBe(400);
    expect(applyRes).toBeNull();
    expect(await Application.countDocuments({ job: job.id })).toBe(0);
  });

  it("rejects a duplicate application to the same job (409)", async () => {
    const emp = await makeUser("employer");
    const applicant = await makeUser("applicant");
    const job = await makeJob(emp.id, { status: "published" });

    await submitApplication(applicant.id, job.id, "pdf-to-pdf.pdf");
    const { preRes, applyRes } = await submitApplication(
      applicant.id,
      job.id,
      "pdf-to-pdf.pdf",
    );

    // Rejected before the CV is uploaded.
    expect(preRes.statusCode).toBe(409);
    expect(applyRes).toBeNull();
    expect(await Application.countDocuments({ job: job.id })).toBe(1);
  });

  it("forbids applying to a non-published job (403)", async () => {
    const emp = await makeUser("employer");
    const applicant = await makeUser("applicant");
    const job = await makeJob(emp.id, { status: "draft" });

    const { preRes, applyRes } = await submitApplication(
      applicant.id,
      job.id,
      "pdf-to-pdf.pdf",
    );

    // Rejected before the CV is uploaded.
    expect(preRes.statusCode).toBe(403);
    expect(applyRes).toBeNull();
    expect(await Application.countDocuments({ job: job.id })).toBe(0);
  });

  it("requires a CV file (400)", async () => {
    const emp = await makeUser("employer");
    const applicant = await makeUser("applicant");
    const job = await makeJob(emp.id, { status: "published" });
    const req = mockReq({
      user: { id: applicant.id, role: "applicant" },
      params: { id: job.id },
      body: {},
    });
    const res = mockRes();

    await applyToJob(req, res, next);

    expect(res.statusCode).toBe(400);
  });
});
