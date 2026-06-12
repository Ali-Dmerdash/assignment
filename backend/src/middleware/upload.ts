import { mkdir, unlink, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import multer from "multer";
import { fileTypeFromFile } from "file-type";
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

/**
 * Where CVs are written. In Docker this is the mounted `uploads` volume
 * (compose sets UPLOAD_DIR=/app/uploads); locally it defaults to ./uploads.
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";
/** Max accepted CV size (5 MB). */
const MAX_CV_BYTES = 5 * 1024 * 1024;

/**
 * Stream the upload straight to disk (the uploads volume) instead of buffering
 * it in memory. The file is given a random, extension-less name — its real type
 * isn't known until `validateCv` inspects the bytes.
 */
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    mkdir(UPLOAD_DIR, { recursive: true }).then(
      () => cb(null, UPLOAD_DIR),
      (err: unknown) => cb(err as Error, UPLOAD_DIR),
    );
  },
  filename(_req, _file, cb) {
    cb(null, randomUUID());
  },
});

const upload = multer({ storage, limits: { fileSize: MAX_CV_BYTES, files: 1 } });

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
 * Runs after `uploadCv`. Validates the file already written to the volume by its
 * real content. On success it renames the file to carry the correct extension
 * and exposes normalized metadata on `req.cvFile`. On failure (no file, or an
 * unaccepted type) it deletes the file from the volume and responds 400.
 */
export const validateCv: RequestHandler = async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ error: "A CV file is required" });
    return;
  }

  const savedPath = req.file.path;
  try {
    // Inspect the actual bytes on disk — ignores the client name and mimetype.
    const detected = await fileTypeFromFile(savedPath, {
      customDetectors: CV_DETECTORS,
    });
    const mimeType = detected ? toCanonicalMime(detected.mime) : undefined;

    if (!mimeType) {
      await unlink(savedPath).catch(() => {}); // drop the rejected file
      res.status(400).json({ error: "CV must be a PDF, DOC, or DOCX file" });
      return;
    }

    // Now that the real type is known, give the file its correct extension.
    const filename = `${req.file.filename}.${EXTENSION[mimeType]}`;
    const finalPath = `${savedPath}.${EXTENSION[mimeType]}`;
    await rename(savedPath, finalPath);

    req.cvFile = {
      filename,
      originalName: req.file.originalname,
      mimeType,
      size: req.file.size,
      path: finalPath,
    };
    next();
  } catch (err) {
    await unlink(savedPath).catch(() => {}); // best-effort cleanup on error
    next(err);
  }
};
