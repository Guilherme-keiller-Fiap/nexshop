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
  status: RiskDecision | "processing";
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

export type PollOptions = { intervalMs?: number; timeoutMs?: number };

let started = false;
let sessionId: string =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as any).randomUUID()
    : `${Date.now()}-${Math.random()}`;
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
    screen: { w: screen.width, h: screen.height, dpr: window.devicePixelRatio || 1 },
    platform: nav?.platform ?? "unknown",
    sessionId,
    pageTimeMs: Date.now() - pageStart - tabInactiveMs,
    mouseMoves,
    tabInactiveMs,
    lastActivityTs: Date.now(),
    sdkVersion: "1.0.0"
  };
}

function resultUrlFor(endpoint: string, id: string) {
  try {
    const u = new URL(endpoint);
    const path = u.pathname.endsWith("/identity/verify")
      ? u.pathname.replace(/\/identity\/verify$/, `/identity/result/${id}`)
      : `/identity/result/${id}`;
    return `${u.origin}${path}`;
  } catch {
    return `/identity/result/${id}`;
  }
}

export function initSDK(opts: InitOptions) {
  if (!started && typeof window !== "undefined") {
    started = true;
    window.addEventListener("mousemove", () => { mouseMoves++; }, { passive: true });
    window.addEventListener("blur", () => { lastBlur = Date.now(); }, { passive: true });
    window.addEventListener("focus", () => { if (lastBlur) tabInactiveMs += Date.now() - lastBlur; }, { passive: true });
  }

  async function verify(
    payload: Partial<Omit<VerifyRequest, "snapshot">> = {},
    options?: { async?: boolean }
  ): Promise<VerifyResponse> {
    const body: VerifyRequest = {
      context: payload.context ?? opts.context ?? "login",
      userId: payload.userId,
      emailHash: payload.emailHash,
      snapshot: snapshot()
    };
    let url = opts.endpoint;
    if (options?.async) url += url.includes("?") ? "&async=1" : "?async=1";
    const res = await fetch(url, {
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

  async function poll(requestId: string, p?: PollOptions): Promise<VerifyResponse> {
    const interval = p?.intervalMs ?? 800;
    const timeout = p?.timeoutMs ?? 10000;
    const deadline = Date.now() + timeout;
    const url = resultUrlFor(opts.endpoint, requestId);
    for (;;) {
      const r = await fetch(url, {
        method: "GET",
        headers: { ...(opts.apiKey ? { "x-api-key": opts.apiKey } : {}) },
        credentials: "omit"
      });
      const j = (await r.json()) as VerifyResponse;
      if (j.status !== "processing") return j;
      if (Date.now() > deadline) return j;
      await new Promise((res) => setTimeout(res, interval));
    }
  }

  return { verify, poll };
}

export default { initSDK };
