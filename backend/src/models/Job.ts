import {
  Schema,
  model,
  type Model,
  type Types,
  type HydratedDocument,
} from "mongoose";

/** Job lifecycle: only `published` jobs are visible/applicable to applicants. */
export const JOB_STATUSES = ["draft", "published", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Persisted shape of a job posting. */
export interface IJob {
  title: string;
  company: string;
  description: string;
  location?: string;
  salary?: string;
  status: JobStatus;
  employer: Types.ObjectId; // ref -> User (the owner)
  datePosted?: Date; // set when first published; unset while still a draft
  createdAt: Date;
  updatedAt: Date;
}

export type JobModel = Model<IJob>;
export type JobDocument = HydratedDocument<IJob>;

const jobSchema = new Schema<IJob, JobModel>(
  {
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    // Optional per the spec — free-form so values like "Remote" are allowed.
    location: { type: String, trim: true },
    salary: { type: String, trim: true },
    status: {
      type: String,
      enum: JOB_STATUSES,
      required: true,
      default: "draft",
    },
    employer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Set server-side the first time the job is published (see the pre-save
    // hook below). Never trusted from the client; unset while a draft.
    datePosted: { type: Date },
  },
  { timestamps: true },
);

// Stamp the publish time once — the first time the job becomes (or is created
// as) "published". Guarded by `!this.datePosted` so it never moves on later
// saves (e.g. when the job is closed). NOTE: like all `save` middleware this
// only runs on document .save()/.create(), so publish via a loaded document,
// not findOneAndUpdate.
jobSchema.pre("save", function () {
  if (this.status === "published" && !this.datePosted) {
    this.datePosted = new Date();
  }
});

// Public listing: filter by status (+ optional location), newest first.
jobSchema.index({ status: 1, datePosted: -1 });

export const Job = model<IJob, JobModel>("Job", jobSchema);
