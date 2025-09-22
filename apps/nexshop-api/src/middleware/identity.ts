import type { Request, Response, NextFunction } from "express";
import { cfg } from "../config.js";
import { processNow, enqueue } from "../core/jobs.js";

type RiskDecision = "allow" | "review" | "deny";

type ClientSnapshot = {
  userAgent: string;
  languages: readonly string[];
  timezone: string;
  screen: { w: number; h: number; dpr: number };
  platform: string;
  sessionId: string;
  pageTimeMs: number;
  mouseMoves: number;
  tabInactiveMs: number;
  lastActivityTs: number;
  sdkVersion: string;
};

type VerifyRequest = {
  context: "login" | "checkout" | "sensitive";
  userId?: string;
  emailHash?: string;
  snapshot: ClientSnapshot;
};

type VerifyResponse = {
  status: RiskDecision;
  score: number;
  reasons: string[];
  requestId: string;
};

function parseIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (Array.isArray(xff) && xff.length) return xff[0].split(",")[0].trim();
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return (req.ip || "").toString();
}

function validateBody(body: any): body is VerifyRequest {
  if (!body || typeof body !== "object") return false;
  if (!body.snapshot || typeof body.snapshot !== "object") return false;
  const okCtx = body.context === "login" || body.context === "checkout" || body.context === "sensitive";
  const s = body.snapshot;
  const keys = ["userAgent", "languages", "timezone", "screen", "platform", "sessionId", "pageTimeMs", "mouseMoves", "tabInactiveMs", "lastActivityTs", "sdkVersion"];
  return okCtx && keys.every((k) => k in s);
}

export function createVerifyMiddleware(_: { sensitivity?: number } = {}) {
  return async (req: Request, res: Response, _next: NextFunction) => {
    const body = req.body as VerifyRequest;
    if (!validateBody(body)) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }
    const ip = parseIp(req);
    const isAsync =
      String(req.query.async || "").toLowerCase() === "1" ||
      String(req.headers["x-async"] || "").toLowerCase() === "1" ||
      String(req.headers["x-async"] || "").toLowerCase() === "true";

    if (isAsync) {
      const id = enqueue(body, ip, 1500);
      const pending: VerifyResponse = {
        status: "review",
        score: 0,
        reasons: ["processing"],
        requestId: id
      };
      res.status(202).json(pending);
      return;
    }

    const resp = await processNow(body, ip);
    res.status(200).json(resp);
  };
}
