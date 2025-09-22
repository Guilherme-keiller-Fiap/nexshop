import type { Request, Response, NextFunction } from "express";
import { cfg } from "../config.js";

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

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

function scoreFromSnapshot(s: ClientSnapshot) {
  const t = s.pageTimeMs;
  const m = s.mouseMoves;
  const inact = s.tabInactiveMs;

  const timeScore = t >= 3000 ? 0.9 : t >= 1500 ? 0.75 : 0.4;
  const mouseScore = m >= 6 ? 0.9 : m >= 3 ? 0.75 : 0.45;
  const inactivityPenalty = inact >= 60_000 ? 0.25 : 0;

  const base = clamp((timeScore + mouseScore) / 2 - inactivityPenalty, 0, 1);
  return base;
}

function decide(score0to100: number): RiskDecision {
  if (score0to100 >= 75) return "allow";
  if (score0to100 >= cfg.reviewMinScore) return "review";
  return "deny";
}

function validateBody(body: any): body is VerifyRequest {
  if (!body || typeof body !== "object") return false;
  if (!body.snapshot || typeof body.snapshot !== "object") return false;
  const okCtx = body.context === "login" || body.context === "checkout" || body.context === "sensitive";
  const s = body.snapshot;
  const keys = ["userAgent", "languages", "timezone", "screen", "platform", "sessionId", "pageTimeMs", "mouseMoves", "tabInactiveMs", "lastActivityTs", "sdkVersion"];
  return okCtx && keys.every((k) => k in s);
}

export function createVerifyMiddleware(opts?: { sensitivity?: number }) {
  const sensitivity = typeof opts?.sensitivity === "number" ? opts!.sensitivity : cfg.sensitivity;
  return (req: Request, res: Response, _next: NextFunction) => {
    const body = req.body as VerifyRequest;
    if (!validateBody(body)) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }

    const ip = parseIp(req);
    const reasons: string[] = [];

    if (cfg.blockedIps.includes(ip)) {
      const resp: VerifyResponse = {
        status: "deny",
        score: 10,
        reasons: ["blocked_ip", ...reasons],
        requestId: crypto.randomUUID()
      };
      res.status(200).json(resp);
      return;
    }

    const base = scoreFromSnapshot(body.snapshot);
    let score = base;

    if (cfg.trustedIps.includes(ip)) {
      score = clamp(score + 0.1);
      reasons.push("trusted_ip");
    }

    if (body.snapshot.tabInactiveMs >= 60_000) reasons.push("long_inactive_tab");
    if (body.snapshot.pageTimeMs < 1500) reasons.push("low_page_time");
    if (body.snapshot.mouseMoves < 3) reasons.push("low_mouse_activity");

    const adjusted = clamp(score * (1 - 0.3 * clamp(sensitivity, 0, 1)), 0, 1);
    const score100 = Math.round(adjusted * 100);

    const status = decide(score100);
    const resp: VerifyResponse = {
      status,
      score: score100,
      reasons: reasons.length ? reasons : ["ok"],
      requestId: crypto.randomUUID()
    };
    res.status(200).json(resp);
  };
}
