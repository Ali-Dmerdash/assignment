import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { detectPdf } from "@file-type/pdf";
import { detectCfbf } from "@file-type/cfbf";
import {
  CV_MIME_TYPES,
  type CvMimeType,
  type ICvFile,
} from "../models/Application.js";

/**
 * Module augmentation: after `validateCv` runs, the request carries normalized,
 * server-validated CV metadata for the controller to persist on the Application.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      cvFile?: ICvFile;
    }
  }
}

/** Where validated CVs are written. Configurable; defaults to ./uploads. */
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";
/** Max accepted CV size (5 MB). */
const MAX_CV_BYTES = 5 * 1024 * 1024;

/**
 * Buffer the upload in memory (CVs are small) so we can inspect the actual
 * bytes before anything touches disk. The browser-supplied Content-Type and
 * filename are NOT trusted — see `validateCv`.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CV_BYTES, files: 1 },
});

/** Accept a single file under the `cv` form field. */
export const uploadCv: RequestHandler = upload.single("cv");

/**
 * Extra file-type detectors, run before the built-ins:
 * - detectCfbf: reads the OLE2/CFB root CLSID to identify the *specific* legacy
 *   Office app, so a real .doc reports `application/msword` while an .xls/.ppt
 *   renamed to .doc reports its true type (and is rejected). This is what
 *   resolves the otherwise-ambiguous CFB container.
 * - detectPdf: inspects internal PDF structure, so an Adobe Illustrator file
 *   (which shares the %PDF magic) reports `application/illustrator` and is
 *   rejected instead of slipping through as a PDF.
 * (DECISIONS.md candidate.)
 */
const CV_DETECTORS = [detectCfbf, detectPdf];

/** Extension used when persisting, keyed by the canonical MIME type. */
const EXTENSION: Record<CvMimeType, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

/** Narrow a detected MIME to one of our accepted types, or undefined. */
function toCanonicalMime(mime: string): CvMimeType | undefined {
  return (CV_MIME_TYPES as readonly string[]).includes(mime)
    ? (mime as CvMimeType)
    : undefined;
}

/**
 * Runs after `uploadCv`. Validates the buffered file by its real content, then
 * writes it to disk and exposes normalized metadata on `req.cvFile`. Responds
 * 400 when no file was sent or the content is not an accepted type. Nothing is
 * written to disk unless validation passes.
 */
export const validateCv: RequestHandler = async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ error: "A CV file is required" });
    return;
  }

  try {
    // Inspect the actual bytes — ignores the client-supplied name and mimetype.
    const detected = await fileTypeFromBuffer(req.file.buffer, {
      customDetectors: CV_DETECTORS,
    });
    const mimeType = detected ? toCanonicalMime(detected.mime) : undefined;

    if (!mimeType) {
      res.status(400).json({ error: "CV must be a PDF, DOC, or DOCX file" });
      return;
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${randomUUID()}.${EXTENSION[mimeType]}`;
    const fullPath = join(UPLOAD_DIR, filename);
    await writeFile(fullPath, req.file.buffer);

    req.cvFile = {
      filename,
      originalName: req.file.originalname,
      mimeType,
      size: req.file.size,
      path: fullPath,
    };
    next();
  } catch (err) {
    next(err);
  }
};
