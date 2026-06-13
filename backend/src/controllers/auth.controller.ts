import type { RequestHandler } from "express";
import * as bcrypt from "bcrypt";
import { User, USER_ROLES, type UserRole } from "../models/User.js";
import { signToken } from "../middleware/auth.js";

const BCRYPT_ROUNDS = 12;

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/**
 * POST /api/auth/register
 */
export const register: RequestHandler = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body ?? {};

    if (!name || !email || !password || !role) {
      res
        .status(400)
        .json({ error: "name, email, password and role are required" });
      return;
    }
    if (!USER_ROLES.includes(role)) {
      res.status(400).json({ error: "role must be 'employer' or 'applicant'" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      name,
      email,
      password: passwordHash,
      role,
    });

    const token = signToken({ id: user.id, role: user.role });
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      res
        .status(409)
        .json({ error: "An account with that email already exists" });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/auth/login
 */
export const login: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({ id: user.id, role: user.role });
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
};
