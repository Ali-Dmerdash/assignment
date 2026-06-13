import mongoose from "mongoose";
import type { Request, Response, NextFunction } from "express";

// A dedicated test database on the running (Docker) Mongo. Override via MONGO_URI.
const TEST_URI =
  process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/jobboard_test";

export async function connectTestDb(): Promise<void> {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 5000 });
}

/**
 * Empty every collection in the database. Uses the driver's collection list
 * (not mongoose.connection.collections, which only lists models touched this
 * process) so nothing is missed.
 */
export async function clearTestDb(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  for (const coll of await db.collections()) {
    await coll.deleteMany({});
  }
}

export async function disconnectTestDb(): Promise<void> {
  // Note: the database is intentionally left in place after the run for
  // inspection (data is still cleared between tests for isolation).
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export interface RecordingResponse {
  statusCode: number;
  body: unknown;
}

/** Minimal Express Response that records the status code and JSON body. */
export function mockRes(): Response & RecordingResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: unknown) => {
    res.body = body;
    return res;
  };
  return res;
}

// Returns `any` so the same mock works for handlers typed with specific params
// (e.g. RequestHandler<{ id: string }>); the input shape is still checked.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mockReq(props: Partial<Request>): any {
  return props;
}

/** A next() that rethrows, so an unexpected controller error fails the test. */
export const throwingNext: NextFunction = (err?: unknown) => {
  if (err) throw err;
};
