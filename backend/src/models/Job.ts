import {
  Schema,
  model,
  type Model,
  type Types,
  type HydratedDocument,
} from "mongoose";

export const JOB_STATUSES = ["draft", "published", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface IJob {
  title: string;
  company: string;
  description: string;
  location?: string;
  salary?: string;
  status: JobStatus;
  employer: Types.ObjectId;
  datePosted?: Date;
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
    datePosted: { type: Date },
  },
  { timestamps: true },
);

jobSchema.pre("save", function () {
  if (this.status === "published" && !this.datePosted) {
    this.datePosted = new Date();
  }
});

jobSchema.index({ status: 1, datePosted: -1 });

export const Job = model<IJob, JobModel>("Job", jobSchema);
