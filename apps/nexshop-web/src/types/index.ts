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
