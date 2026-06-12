import type { Request, Response, NextFunction, RequestHandler } from "express";
import * as jwt from "jsonwebtoken";

/** The two roles in the system. */
export type UserRole = "employer" | "applicant";

/** Shape attached to `req.user` once a request is authenticated. */
export interface AuthUser {
  id: string;
  role: UserRole;
}

/**
 * Module augmentation: teach Express that a request may carry a `user`.
 *
 * Chosen over a custom `AuthedRequest` interface so that every handler and
 * middleware sees the same `req.user` typing without per-handler casts. The
 * trade-off is that it's a global augmentation (any Request looks like it
 * *might* have a user); we accept that and rely on `authenticate` running
 * first to guarantee it's set on protected routes. (DECISIONS.md candidate.)
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Read a required env var or fail fast at boot — never hardcode secrets. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Refusing to start without it.`);
  }
  return value;
}

// Resolved once at module load so a missing secret crashes on startup rather
// than on the first request that needs it.
const JWT_SECRET = requireEnv("JWT_SECRET");
const TOKEN_TTL = "7d";

/**
 * Sign a JWT for a freshly authenticated user. Used by the auth controller on
 * register/login. The user id goes in the standard `sub` claim.
 */
export function signToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, JWT_SECRET, {
    subject: user.id,
    expiresIn: TOKEN_TTL,
  });
}

/**
 * Verify the `Authorization: Bearer <token>` header and attach `req.user`.
 * Responds 401 when the token is missing, malformed, expired, or invalid.
 */
export const authenticate: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // A string payload (or one missing our claims) is not a token we issued.
    if (typeof decoded === "string" || !decoded.sub || !("role" in decoded)) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    req.user = { id: decoded.sub, role: decoded.role as UserRole };
    next();
  } catch {
    // TokenExpiredError / JsonWebTokenError — don't leak which to the client.
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * Restrict a route to one or more roles. Must run *after* `authenticate`.
 * Responds 401 if unauthenticated, 403 if the role isn't permitted.
 */
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
