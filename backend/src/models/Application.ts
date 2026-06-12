import {
  Schema,
  model,
  type Model,
  type Types,
  type HydratedDocument,
} from "mongoose";

/** Accepted CV MIME types. The server validates the real MIME of the uploaded
 * bytes (not the file extension) and rejects anything not in this set. */
export const CV_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
export type CvMimeType = (typeof CV_MIME_TYPES)[number];

/**
 * Metadata for an uploaded CV. The file itself lives on disk/storage; we keep
 * the server-validated MIME type (from the actual content, not the extension).
 */
export interface ICvFile {
  filename: string; // stored (disk/storage) filename
  originalName: string; // name as uploaded by the user
  mimeType: CvMimeType; // server-validated MIME type (one of CV_MIME_TYPES)
  size: number; // bytes
  path: string; // location on disk (or storage key/URL)
}

/** Persisted shape of a job application. */
export interface IApplication {
  job: Types.ObjectId; // ref -> Job
  applicant: Types.ObjectId; // ref -> User
  name: string; // captured at submit time (prefilled from profile)
  email: string;
  coverNote?: string;
  cv: ICvFile;
  createdAt: Date;
  updatedAt: Date;
}

export type ApplicationModel = Model<IApplication>;
export type ApplicationDocument = HydratedDocument<IApplication>;

// Embedded subdocument (no own _id — it's owned entirely by the application).
const cvSchema = new Schema<ICvFile>(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, enum: CV_MIME_TYPES, required: true },
    size: { type: Number, required: true },
    path: { type: String, required: true },
  },
  { _id: false },
);

const applicationSchema = new Schema<IApplication, ApplicationModel>(
  {
    job: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    applicant: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    coverNote: { type: String, trim: true },
    cv: { type: cvSchema, required: true },
  },
  { timestamps: true },
);

// Deduplication: one application per applicant per job, enforced at the DB
// level. A duplicate insert throws a E11000 error the controller maps to 409.
applicationSchema.index({ job: 1, applicant: 1 }, { unique: true });

export const Application = model<IApplication, ApplicationModel>(
  "Application",
  applicationSchema,
);
