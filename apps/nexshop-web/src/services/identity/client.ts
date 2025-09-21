import type { VerifyRequest, VerifyResponse } from "../../types";

type InitOptions = {
    endpoint: string;
    context?: VerifyRequest["context"];
    sampleRate?: number;
};

let started = false;
let sessionId = crypto.randomUUID();
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
    if (!started) {
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
        try {
            const res = await fetch(opts.endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            keepalive: true,
            credentials: "omit"
            });
            return await res.json();
        } catch {
            return {
            status: "review",
            score: 50,
            reasons: ["unreachable_backend"],
            requestId: crypto.randomUUID()
            };
        }
        }
    };
}
