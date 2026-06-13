import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyToken, type AuthUser } from "./middleware/auth.js";
import type { ApplicationStatus } from "./models/Application.js";
import { requireEnv } from "./config/env.js";

/** Payload sent to an employer's room when one of their jobs gets an application. */
export interface NewApplicationPayload {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  applicantName: string;
}

/** Payload sent to an applicant's room when the employer accepts/rejects them. */
export interface ApplicationDecisionPayload {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  status: Extract<ApplicationStatus, "accepted" | "rejected">;
}

interface ServerToClientEvents {
  new_application: (payload: NewApplicationPayload) => void;
  application_decision: (payload: ApplicationDecisionPayload) => void;
}
interface SocketData {
  user: AuthUser;
}

type AppServer = Server<
  Record<string, never>,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

let io: AppServer | undefined;

export function initSocket(httpServer: HttpServer): AppServer {
  io = new Server<
    Record<string, never>,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    cors: { origin: requireEnv("CORS_ORIGIN") },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as unknown;
    const user = typeof token === "string" ? verifyToken(token) : null;
    if (!user) {
      next(new Error("Unauthorized"));
      return;
    }
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket) => {
    socket.join(socket.data.user.id);
  });

  return io;
}

export function emitNewApplication(
  employerId: string,
  payload: NewApplicationPayload,
): void {
  io?.to(employerId).emit("new_application", payload);
}

export function emitApplicationDecision(
  applicantId: string,
  payload: ApplicationDecisionPayload,
): void {
  io?.to(applicantId).emit("application_decision", payload);
}
