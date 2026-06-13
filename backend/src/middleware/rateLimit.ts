import { rateLimit } from "express-rate-limit";

export const applyRateLimiter = rateLimit({
  windowMs: 3 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? "anonymous",
  validate: { trustProxy: false, xForwardedForHeader: false },
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many applications. Please try again in a few minutes.",
    });
  },
});
