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
import { requireEnv } from "../config/env.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      cvFile?: ICvFile;
    }
  }
}

const UPLOAD_DIR = requireEnv("UPLOAD_DIR");
/** Max accepted CV size (5 MB). */
const MAX_CV_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CV_BYTES, files: 1 },
});

export const uploadCv: RequestHandler = upload.single("cv");

const CV_DETECTORS = [detectCfbf, detectPdf];

const EXTENSION: Record<CvMimeType, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

function toCanonicalMime(mime: string): CvMimeType | undefined {
  return (CV_MIME_TYPES as readonly string[]).includes(mime)
    ? (mime as CvMimeType)
    : undefined;
}

export async function detectCvMime(
  buffer: Uint8Array,
): Promise<CvMimeType | null> {
  const detected = await fileTypeFromBuffer(buffer, {
    customDetectors: CV_DETECTORS,
  });
  return detected ? (toCanonicalMime(detected.mime) ?? null) : null;
}

export const validateCv: RequestHandler = async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ error: "A CV file is required" });
    return;
  }

  try {
    const mimeType = await detectCvMime(req.file.buffer);
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
