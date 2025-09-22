import express from "express";
import { randomUUID } from "crypto";

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
  context?: VerifyRequest["context"];
  timestamp?: number;
};

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const API_KEY = process.env.API_KEY || "dev-123";
const HTTPS_ONLY = String(process.env.HTTPS_ONLY || "false").toLowerCase() === "true";
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60000);
const RATE_MAX = Number(process.env.RATE_MAX || 120);

function parseList(v?: string) {
  return (v || "").split(",").map((s) => s.trim()).filter(Boolean);
}

const CFG = {
  sensitivity: Math.min(1, Math.max(0, Number(process.env.SENSITIVITY ?? 0.5))),
  reviewMinScore: Math.max(0, Math.min(100, Number(process.env.REVIEW_MIN_SCORE ?? 50))),
  trustedIps: parseList(process.env.TRUSTED_IPS),
  blockedIps: parseList(process.env.BLOCKED_IPS),
  trustedEmailHashes: parseList(process.env.TRUSTED_EMAIL_HASHES),
  blockedEmailHashes: parseList(process.env.BLOCKED_EMAIL_HASHES),
  trustedUserIds: parseList(process.env.TRUSTED_USER_IDS),
  blockedUserIds: parseList(process.env.BLOCKED_USER_IDS),
  callbackUrl: process.env.CALLBACK_URL || "",
  callbackSecret: process.env.CALLBACK_SECRET || ""
};

app.set("trust proxy", true);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-api-key, x-async");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (process.env.NODE_ENV === "production" || HTTPS_ONLY) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    const xfproto = String(req.headers["x-forwarded-proto"] || "");
    const isHttps = req.secure || xfproto.includes("https");
    const isLocal = /localhost|127\.0\.0\.1/.test(String(req.headers.host || ""));
    if (!isHttps && !isLocal) return res.status(403).json({ error: "https_required" });
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "25kb" }));

const rl = new Map<string, { count: number; resetAt: number }>();
function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = parseIp(req);
  const now = Date.now();
  const cur = rl.get(ip);
  if (!cur || now > cur.resetAt) {
    rl.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }
  cur.count += 1;
  if (cur.count > RATE_MAX) return res.status(429).json({ error: "rate_limited" });
  next();
}
app.use(rateLimit);

function parseIp(req: express.Request) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  if (Array.isArray(xff) && xff.length) return xff[0].split(",")[0].trim();
  return (req.ip || "").toString();
}

function sameOrigin(req: express.Request) {
  const o = String(req.headers.origin || "");
  if (o && o === ORIGIN) return true;
  const ref = String(req.headers.referer || "");
  try {
    if (ref) {
      const r = new URL(ref);
      return `${r.protocol}//${r.host}` === ORIGIN;
    }
  } catch {}
  return false;
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

function computeDecision(body: VerifyRequest, ip: string, requestId: string): VerifyResponse {
  if (CFG.blockedIps.includes(ip)) return { status: "deny", score: 10, reasons: ["blocked_ip"], requestId, context: body.context, timestamp: Date.now() };
  if (body.emailHash && CFG.blockedEmailHashes.includes(body.emailHash)) return { status: "deny", score: 10, reasons: ["blocked_email"], requestId, context: body.context, timestamp: Date.now() };
  if (body.userId && CFG.blockedUserIds.includes(body.userId)) return { status: "deny", score: 10, reasons: ["blocked_user"], requestId, context: body.context, timestamp: Date.now() };
  let score0to1 = scoreFromSnapshot(body.snapshot);
  if (CFG.trustedIps.includes(ip)) score0to1 = Math.min(1, score0to1 + 0.1);
  if (body.emailHash && CFG.trustedEmailHashes.includes(body.emailHash)) score0to1 = Math.min(1, score0to1 + 0.1);
  if (body.userId && CFG.trustedUserIds.includes(body.userId)) score0to1 = Math.min(1, score0to1 + 0.1);
  const adjusted = Math.max(0, Math.min(1, score0to1 * (1 - 0.3 * CFG.sensitivity)));
  const score = Math.round(adjusted * 100);
  let status: RiskDecision = "deny";
  if (score >= 75) status = "allow";
  else if (score >= CFG.reviewMinScore) status = "review";
  const reasons: string[] = [];
  if (body.snapshot.tabInactiveMs >= 60000) reasons.push("long_inactive_tab");
  if (body.snapshot.pageTimeMs < 1500) reasons.push("low_page_time");
  if (body.snapshot.mouseMoves < 3) reasons.push("low_mouse_activity");
  if (reasons.length === 0) reasons.push("ok");
  return { status, score, reasons, requestId, context: body.context, timestamp: Date.now() };
}

const results = new Map<string, VerifyResponse>();

function isAsync(req: express.Request) {
  const q = String(req.query.async || "").toLowerCase();
  const h = String(req.headers["x-async"] || "").toLowerCase();
  return q === "1" || q === "true" || h === "1" || h === "true";
}

app.post("/identity/verify", async (req, res) => {
  const hasKey = req.get("x-api-key") === API_KEY;
  const fromAllowedOrigin = sameOrigin(req);
  if (!hasKey && !fromAllowedOrigin) return res.status(401).json({ error: "unauthorized" });
  const ip = parseIp(req);
  const body = req.body as VerifyRequest;
  const valid = body && (body.context === "login" || body.context === "checkout" || body.context === "sensitive") && body.snapshot && typeof body.snapshot === "object";
  if (!valid) return res.status(400).json({ error: "invalid_payload" });
  if (isAsync(req)) {
    const requestId = randomUUID();
    setTimeout(async () => {
      const resp = computeDecision(body, ip, requestId);
      results.set(requestId, resp);
      if (CFG.callbackUrl) {
        try {
          await fetch(CFG.callbackUrl, {
            method: "POST",
            headers: { "content-type": "application/json", ...(CFG.callbackSecret ? { "x-callback-secret": CFG.callbackSecret } : {}) },
            body: JSON.stringify(resp)
          });
        } catch {}
      }
    }, 1500);
    return res.status(202).json({ status: "review", score: 0, reasons: ["processing"], requestId });
  }
  const requestId = randomUUID();
  const resp = computeDecision(body, ip, requestId);
  return res.status(200).json(resp);
});

app.get("/identity/result/:id", (req, res) => {
  const id = req.params.id;
  const found = results.get(id);
  if (!found) return res.json({ status: "review", score: 0, reasons: ["processing"], requestId: id });
  return res.json(found);
});

app.get("/", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`nexshop-api listening at http://localhost:${PORT}`);
});
