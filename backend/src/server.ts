import "dotenv/config";

import { createServer } from "node:http";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import multer from "multer";
import { connectDB, disconnectDB } from "./config/db.js";
import { requireEnv } from "./config/env.js";
import { initSocket } from "./socket.js";
import authRoutes from "./routes/auth.routes.js";
import jobRoutes from "./routes/jobs.routes.js";

const PORT = Number(requireEnv("PORT"));
const CORS_ORIGIN = requireEnv("CORS_ORIGIN");

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

async function start(): Promise<void> {
  await connectDB();

  const httpServer = createServer(app);
  const io = initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });

  const shutdown = () => {
    io.close(() => {
      void disconnectDB().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
