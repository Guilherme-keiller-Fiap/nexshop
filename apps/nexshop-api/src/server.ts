import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { z } from "zod";
import { randomUUID } from "node:crypto";

type RiskDecision = "allow" | "review" | "deny";

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173", credentials: false }));
app.use(express.json({ limit: "100kb" }));

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

function decide(score: number): RiskDecision {
  if (score >= 75) return "allow";
  if (score <= 35) return "deny";
  return "review";
}

app.post("/identity/verify", (req, res) => {
  try {
    const data = verifySchema.parse(req.body);
    const rules = [
      data.snapshot.pageTimeMs > 1500 ? 0.9 : 0.5,
      data.snapshot.mouseMoves >= 3 ? 0.85 : 0.4,
      data.snapshot.tabInactiveMs < 60000 ? 0.8 : 0.6
    ];
    const score = Math.max(0, Math.min(100, Math.round(avg(rules) * 100)));
    const reasons: string[] = [];
    if (data.snapshot.pageTimeMs <= 1500) reasons.push("low_page_time");
    if (data.snapshot.mouseMoves < 3) reasons.push("low_mouse_activity");
    if (data.snapshot.tabInactiveMs >= 60000) reasons.push("high_tab_inactive");
    if (reasons.length === 0) reasons.push("ok");
    const body = {
      status: decide(score),
      score,
      reasons,
      requestId: randomUUID()
    } as const;
    res.status(200).json(body);
  } catch {
    res.status(400).json({ error: "invalid_payload" });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port);
