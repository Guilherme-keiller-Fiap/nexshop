export type RiskDecision = "allow" | "review" | "deny";

export interface ClientSnapshot {
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
}

export interface VerifyRequest {
  context: "login" | "checkout" | "sensitive";
  userId?: string;
  emailHash?: string;
  snapshot: ClientSnapshot;
}

export interface VerifyResponse {
  status: RiskDecision;
  score: number;
  reasons: string[];
  requestId: string;
}

export type InitOptions = {
  endpoint: string;
  apiKey?: string;
  context?: VerifyRequest["context"];
  sampleRate?: number;
};

let started = false;
let sessionId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
let mouseMoves = 0;
let tabInactiveMs = 0;
let lastBlur = 0;
let pageStart = Date.now();

function snapshot(): VerifyRequest["snapshot"] {
  const nav = navigator as any;
  return {
    userAgent: navigator.userAgent,
    languages: navigator.languages,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "unknown",
    screen: { w: screen.width, h: screen.height, dpr: devicePixelRatio },
    platform: nav.platform ?? "unknown",
    sessionId,
    pageTimeMs: Date.now() - pageStart,
    mouseMoves,
    tabInactiveMs,
    lastActivityTs: Date.now(),
    sdkVersion: "1.0.0"
  };
}

export function initSDK(opts: InitOptions) {
  if (!started && typeof window !== "undefined") {
    started = true;
    window.addEventListener("mousemove", () => { mouseMoves++; }, { passive: true });
    window.addEventListener("blur", () => { lastBlur = Date.now(); }, { passive: true });
    window.addEventListener("focus", () => {
      if (lastBlur) tabInactiveMs += Date.now() - lastBlur;
    }, { passive: true });
  }

  return {
    async verify(payload: Partial<Omit<VerifyRequest, "snapshot">> = {}): Promise<VerifyResponse> {
      const body: VerifyRequest = {
        context: payload.context ?? opts.context ?? "login",
        userId: payload.userId,
        emailHash: payload.emailHash,
        snapshot: snapshot()
      };
      const res = await fetch(opts.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(opts.apiKey ? { "x-api-key": opts.apiKey } : {})
        },
        body: JSON.stringify(body),
        keepalive: true,
        credentials: "omit"
      });
      return res.json();
    }
  };
}

export default { initSDK };
