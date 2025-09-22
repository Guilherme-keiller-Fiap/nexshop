import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export type RiskDecision = "allow" | "review" | "deny";

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
  context?: VerifyRequest["context"];
  timestamp?: number;
};

type CreateOpts = {
  apiKey?: string;
  allowOrigin: string;
  sensitivity: number;
  reviewMinScore: number;
  trustedIps: string[];
  blockedIps: string[];
  trustedEmailHashes: string[];
  blockedEmailHashes: string[];
  trustedUserIds: string[];
  blockedUserIds: string[];
  callbackUrl?: string;
  callbackSecret?: string;
};

function sameOrigin(req: Request, allowOrigin: string) {
  const o = String(req.headers.origin || "");
  if (o && o === allowOrigin) return true;
  const ref = String(req.headers.referer || "");
  try {
    if (ref) {
      const r = new URL(ref);
      return `${r.protocol}//${r.host}` === allowOrigin;
    }
  } catch {}
  return false;
}

function parseIp(req: Request) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  if (Array.isArray(xff) && xff.length) return xff[0].split(",")[0].trim();
  return (req.ip || "").toString();
}

function scoreFromSnapshot(s: ClientSnapshot) {
  const t = s.pageTimeMs;
  const m = s.mouseMoves;
  const inact = s.tabInactiveMs;
  const timeScore = t >= 3000 ? 0.9 : t >= 1500 ? 0.75 : 0.4;
  const mouseScore = m >= 6 ? 0.9 : m >= 3 ? 0.75 : 0.45;
  const inactivityPenalty = inact >= 60000 ? 0.25 : 0;
  const base = Math.max(0, Math.min(1, (timeScore + mouseScore) / 2 - inactivityPenalty));
  return base;
}

function computeDecision(body: VerifyRequest, ip: string, cfg: CreateOpts, requestId: string): VerifyResponse {
  if (cfg.blockedIps.includes(ip)) return { status: "deny", score: 10, reasons: ["blocked_ip"], requestId, context: body.context, timestamp: Date.now() };
  if (body.emailHash && cfg.blockedEmailHashes.includes(body.emailHash)) return { status: "deny", score: 10, reasons: ["blocked_email"], requestId, context: body.context, timestamp: Date.now() };
  if (body.userId && cfg.blockedUserIds.includes(body.userId)) return { status: "deny", score: 10, reasons: ["blocked_user"], requestId, context: body.context, timestamp: Date.now() };
  let score0to1 = scoreFromSnapshot(body.snapshot);
  if (cfg.trustedIps.includes(ip)) score0to1 = Math.min(1, score0to1 + 0.1);
  if (body.emailHash && cfg.trustedEmailHashes.includes(body.emailHash)) score0to1 = Math.min(1, score0to1 + 0.1);
  if (body.userId && cfg.trustedUserIds.includes(body.userId)) score0to1 = Math.min(1, score0to1 + 0.1);
  const adjusted = Math.max(0, Math.min(1, score0to1 * (1 - 0.3 * cfg.sensitivity)));
  const score = Math.round(adjusted * 100);
  let status: RiskDecision = "deny";
  if (score >= 75) status = "allow";
  else if (score >= cfg.reviewMinScore) status = "review";
  const reasons: string[] = [];
  if (body.snapshot.tabInactiveMs >= 60000) reasons.push("long_inactive_tab");
  if (body.snapshot.pageTimeMs < 1500) reasons.push("low_page_time");
  if (body.snapshot.mouseMoves < 3) reasons.push("low_mouse_activity");
  if (reasons.length === 0) reasons.push("ok");
  return { status, score, reasons, requestId, context: body.context, timestamp: Date.now() };
}

export function createNexID(cfg: CreateOpts) {
  const results = new Map<string, VerifyResponse>();
  function middleware() {
    return (req: Request, _res: Response, next: NextFunction) => {
      (req as any).__nexid = {
        ip: parseIp(req),
        originOk: sameOrigin(req, cfg.allowOrigin),
        ua: req.get("user-agent") || ""
      };
      next();
    };
  }
  function verifyRoute() {
    return async (req: Request, res: Response) => {
      const hasKey = cfg.apiKey && req.get("x-api-key") === cfg.apiKey;
      const fromAllowedOrigin = Boolean((req as any).__nexid?.originOk);
      if (!hasKey && !fromAllowedOrigin) return res.status(401).json({ error: "unauthorized" });
      const body = req.body as VerifyRequest;
      const valid = body && (body.context === "login" || body.context === "checkout" || body.context === "sensitive") && body.snapshot && typeof body.snapshot === "object";
      if (!valid) return res.status(400).json({ error: "invalid_payload" });
      const isAsync = String(req.query.async || "").toLowerCase() === "1" || String(req.headers["x-async"] || "").toLowerCase() === "1" || String(req.headers["x-async"] || "").toLowerCase() === "true";
      if (isAsync) {
        const requestId = randomUUID();
        setTimeout(async () => {
          const resp = computeDecision(body, (req as any).__nexid?.ip || "", cfg, requestId);
          results.set(requestId, resp);
          if (cfg.callbackUrl) {
            try {
              await fetch(cfg.callbackUrl, {
                method: "POST",
                headers: { "content-type": "application/json", ...(cfg.callbackSecret ? { "x-callback-secret": cfg.callbackSecret } : {}) },
                body: JSON.stringify(resp)
              });
            } catch {}
          }
        }, 1500);
        return res.status(202).json({ status: "review", score: 0, reasons: ["processing"], requestId });
      }
      const requestId = randomUUID();
      const resp = computeDecision(body, (req as any).__nexid?.ip || "", cfg, requestId);
      return res.status(200).json(resp);
    };
  }
  function resultRoute() {
    return (req: Request, res: Response) => {
      const id = req.params.id;
      const found = results.get(id);
      if (!found) return res.json({ status: "review", score: 0, reasons: ["processing"], requestId: id });
      return res.json(found);
    };
  }
  return { middleware, verifyRoute, resultRoute };
}
