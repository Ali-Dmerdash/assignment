import { describe, it, expect, jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { signToken, authenticate, requireRole } from "../src/middleware/auth.js";

// Minimal Response stub that records the status code and JSON body.
function mockRes() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = { statusCode: 200, body: undefined };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  return res as Response & { statusCode: number; body: unknown };
}

const reqWith = (props: Partial<Request>) => props as unknown as Request;

describe("authenticate", () => {
  it("accepts a valid Bearer token and populates req.user", () => {
    const token = signToken({ id: "user-123", role: "employer" });
    const req = reqWith({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({ id: "user-123", role: "employer" });
  });

  it("rejects a missing Authorization header with 401", () => {
    const req = reqWith({ headers: {} });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("rejects a malformed/invalid token with 401", () => {
    const req = reqWith({ headers: { authorization: "Bearer not-a-real-token" } });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    authenticate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});

describe("requireRole", () => {
  it("calls next when the user has an allowed role", () => {
    const mw = requireRole("employer");
    const req = reqWith({ user: { id: "u", role: "employer" } });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("responds 403 when the role is not allowed", () => {
    const mw = requireRole("employer");
    const req = reqWith({ user: { id: "u", role: "applicant" } });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("responds 401 when there is no authenticated user", () => {
    const mw = requireRole("employer");
    const req = reqWith({});
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
