import { Schema, model, type Model, type HydratedDocument } from "mongoose";

export const USER_ROLES = ["employer", "applicant"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export type UserModel = Model<IUser>;
export type UserDocument = HydratedDocument<IUser>;

const userSchema = new Schema<IUser, UserModel>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true },
  },
  { timestamps: true },
);

export const User = model<IUser, UserModel>("User", userSchema);
