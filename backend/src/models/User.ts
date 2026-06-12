import { Schema, model, type Model, type HydratedDocument } from "mongoose";
import * as bcrypt from "bcrypt";

/** The two roles in the system. Canonical source for the role union. */
export const USER_ROLES = ["employer", "applicant"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Persisted shape of a user. */
export interface IUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/** Instance methods available on a user document. */
export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserModel = Model<IUser, {}, IUserMethods>;
export type UserDocument = HydratedDocument<IUser, IUserMethods>;

const BCRYPT_ROUNDS = 12;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // select:false so the hash is never returned by default — login controllers
    // must opt in with `.select("+password")`.
    password: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true },
  },
  { timestamps: true },
);

// Hash the password whenever it is set or changed. Never store plaintext, and
// only re-hash when the field actually changed (avoids double-hashing on edits).
// Async hook with no `next` — Mongoose awaits the returned promise.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
});

userSchema.method(
  "comparePassword",
  function (candidate: string): Promise<boolean> {
    return bcrypt.compare(candidate, this.password);
  },
);

export const User = model<IUser, UserModel>("User", userSchema);
