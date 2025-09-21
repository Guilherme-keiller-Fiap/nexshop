import type { Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";

type RiskDecision = "allow" | "review" | "deny";

const verifySchema = z.object({
    context: z.enum(["login", "checkout", "sensitive"]),
    userId: z.string().optional(),
    emailHash: z.string().optional(),
    snapshot: z.object({
    userAgent: z.string(),
    languages: z.array(z.string()),
    timezone: z.string(),
    screen: z.object({ w: z.number(), h: z.number(), dpr: z.number() }),
    platform: z.string(),
    sessionId: z.string(),
    pageTimeMs: z.number(),
    mouseMoves: z.number(),
    tabInactiveMs: z.number(),
    lastActivityTs: z.number(),
    sdkVersion: z.string()
    })
});

function avg(xs: number[]) {
    return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
}

function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
}

function decide(score: number, sensitivity: number): RiskDecision {
  const allowTh = 70 + sensitivity * 10;
  const denyTh = 40 - sensitivity * 10;
    if (score >= allowTh) return "allow";
    if (score <= denyTh) return "deny";
    return "review";
}

export function createVerifyMiddleware(opts?: { sensitivity?: number }) {
const sensitivity = clamp(opts?.sensitivity ?? 0.5, 0, 1);
    return (req: Request, res: Response) => {
        try {
        const data = verifySchema.parse(req.body);
        const rules = [
            data.snapshot.pageTimeMs > 1500 ? 0.9 : 0.5,
            data.snapshot.mouseMoves >= 3 ? 0.85 : 0.4,
            data.snapshot.tabInactiveMs < 60000 ? 0.8 : 0.6
        ];
        const score = Math.round(clamp(avg(rules) * 100, 0, 100));
        const reasons: string[] = [];
        if (data.snapshot.pageTimeMs <= 1500) reasons.push("low_page_time");
        if (data.snapshot.mouseMoves < 3) reasons.push("low_mouse_activity");
        if (data.snapshot.tabInactiveMs >= 60000) reasons.push("high_tab_inactive");
        if (reasons.length === 0) reasons.push("ok");
        const status = decide(score, sensitivity);
        res.status(200).json({
            status,
            score,
            reasons,
            requestId: randomUUID()
        });
        } catch {
        res.status(400).json({ error: "invalid_payload" });
        }
    };
}
