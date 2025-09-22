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

export function computeDecision(body: VerifyRequest, ip: string, requestId: string): VerifyResponse {
  const reasons: string[] = [];

  if (cfg.blockedIps.includes(ip)) {
    return { status: "deny", score: 10, reasons: ["blocked_ip"], requestId };
  }
  if (body.emailHash && cfg.blockedEmailHashes.includes(body.emailHash)) {
    return { status: "deny", score: 10, reasons: ["blocked_email"], requestId };
  }
  if (body.userId && cfg.blockedUserIds.includes(body.userId)) {
    return { status: "deny", score: 10, reasons: ["blocked_user"], requestId };
  }

  let score = scoreFromSnapshot(body.snapshot);

  if (cfg.trustedIps.includes(ip)) {
    score = clamp(score + 0.1);
    reasons.push("trusted_ip");
  }
  if (body.emailHash && cfg.trustedEmailHashes.includes(body.emailHash)) {
    score = clamp(score + 0.1);
    reasons.push("trusted_email");
  }
  if (body.userId && cfg.trustedUserIds.includes(body.userId)) {
    score = clamp(score + 0.1);
    reasons.push("trusted_user");
  }

  if (body.snapshot.tabInactiveMs >= 60_000) reasons.push("long_inactive_tab");
  if (body.snapshot.pageTimeMs < 1500) reasons.push("low_page_time");
  if (body.snapshot.mouseMoves < 3) reasons.push("low_mouse_activity");

  const adjusted = clamp(score * (1 - 0.3 * clamp(cfg.sensitivity, 0, 1)), 0, 1);
  const score100 = Math.round(adjusted * 100);
  const status = decide(score100);

  return {
    status,
    score: score100,
    reasons: reasons.length ? reasons : ["ok"],
    requestId
  };
}
