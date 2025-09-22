import { cfg } from "../config.js";
import { computeDecision } from "./risk.js";

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

const store = new Map<string, VerifyResponse>();

export function getResult(id: string): VerifyResponse | null {
  return store.get(id) || null;
}

export async function processNow(body: VerifyRequest, ip: string, forcedId?: string): Promise<VerifyResponse> {
  const requestId = forcedId || crypto.randomUUID();
  const resp = computeDecision(body, ip, requestId);
  return resp;
}

export function enqueue(body: VerifyRequest, ip: string, delayMs = 1500): string {
  const requestId = crypto.randomUUID();
  setTimeout(async () => {
    const resp = computeDecision(body, ip, requestId);
    store.set(requestId, resp);
    if (cfg.callbackUrl) {
      try {
        await fetch(cfg.callbackUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(cfg.callbackSecret ? { "x-callback-secret": cfg.callbackSecret } : {})
          },
          body: JSON.stringify(resp)
        });
      } catch {}
    }
  }, delayMs);
  return requestId;
}
