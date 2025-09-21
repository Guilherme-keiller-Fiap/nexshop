import type { Request, Response, NextFunction } from "express";

type Options = { windowMs: number; max: number };
const store = new Map<string, number[]>();

export function rateLimit(opts: Options) {
const windowMs = Math.max(1000, opts.windowMs);
const max = Math.max(1, opts.max);
    return (req: Request, res: Response, next: NextFunction) => {
        const key =
        (req.ip as string) ||
        (Array.isArray(req.headers["x-forwarded-for"])
            ? req.headers["x-forwarded-for"][0]
            : (req.headers["x-forwarded-for"] as string)) ||
        "ip";
        const now = Date.now();
        const cutoff = now - windowMs;
        const arr = (store.get(key) || []).filter((t) => t > cutoff);
        if (arr.length >= max) {
        res.status(429).json({ error: "rate_limited" });
        return;
        }
        arr.push(now);
        store.set(key, arr);
        next();
        setTimeout(() => {
        const current = store.get(key);
        if (!current) return;
        const filtered = current.filter((t) => t > Date.now() - windowMs);
        if (filtered.length === 0) store.delete(key);
        else store.set(key, filtered);
        }, windowMs + 1000);
    };
}
