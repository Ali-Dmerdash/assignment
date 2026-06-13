import type { Request, Response, NextFunction, RequestHandler } from "express";
import * as jwt from "jsonwebtoken";
import { requireEnv } from "../config/env.js";

export type UserRole = "employer" | "applicant";

export interface AuthUser {
  id: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = requireEnv("JWT_SECRET");
const TOKEN_TTL = "7d";

export function signToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, JWT_SECRET, {
    subject: user.id,
    expiresIn: TOKEN_TTL,
  });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "string" || !decoded.sub || !("role" in decoded)) {
      return null;
    }
    return { id: decoded.sub, role: decoded.role as UserRole };
  } catch {
    return null;
  }
}

export const authenticate: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const user = verifyToken(header.slice("Bearer ".length).trim());
  if (!user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.user = user;
  next();
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden: insufficient role" });
      return;
    }
    next();
  };
}
