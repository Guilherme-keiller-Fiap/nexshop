import express from "express";
import { createNexID } from "./nexid.js";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const API_KEY = process.env.API_KEY || "";
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
  const ip = (req.ip || "").toString();
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

const nexid = createNexID({
  apiKey: API_KEY || undefined,
  allowOrigin: ORIGIN,
  sensitivity: CFG.sensitivity,
  reviewMinScore: CFG.reviewMinScore,
  trustedIps: CFG.trustedIps,
  blockedIps: CFG.blockedIps,
  trustedEmailHashes: CFG.trustedEmailHashes,
  blockedEmailHashes: CFG.blockedEmailHashes,
  trustedUserIds: CFG.trustedUserIds,
  blockedUserIds: CFG.blockedUserIds,
  callbackUrl: CFG.callbackUrl || undefined,
  callbackSecret: CFG.callbackSecret || undefined
});

app.use(nexid.middleware());
app.post("/identity/verify", nexid.verifyRoute());
app.get("/identity/result/:id", nexid.resultRoute());

app.get("/", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`nexshop-api listening at http://localhost:${PORT}`);
});
