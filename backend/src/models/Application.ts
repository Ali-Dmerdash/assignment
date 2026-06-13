import {
  Schema,
  model,
  type Model,
  type Types,
  type HydratedDocument,
} from "mongoose";

export const CV_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
export type CvMimeType = (typeof CV_MIME_TYPES)[number];

export const APPLICATION_STATUSES = [
  "pending",
  "accepted",
  "rejected",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface ICvFile {
  filename: string;
  originalName: string;
  mimeType: CvMimeType;
  size: number;
  path: string;
}

export interface IApplication {
  job: Types.ObjectId;
  applicant: Types.ObjectId;
  name: string;
  email: string;
  coverNote?: string;
  cv: ICvFile;
  status: ApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ApplicationModel = Model<IApplication>;
export type ApplicationDocument = HydratedDocument<IApplication>;

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
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      required: true,
      default: "pending",
    },
  },
  { timestamps: true },
);

applicationSchema.index({ job: 1, applicant: 1 }, { unique: true });

export const Application = model<IApplication, ApplicationModel>(
  "Application",
  applicationSchema,
);
