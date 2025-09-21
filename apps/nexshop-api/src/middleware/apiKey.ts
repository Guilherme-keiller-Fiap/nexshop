import type { Request, Response, NextFunction } from "express";

export function apiKey() {
return (req: Request, res: Response, next: NextFunction) => {
    const key = req.header("x-api-key");
    if (key && key === process.env.API_KEY) return next();
    res.status(401).json({ error: "unauthorized" });
    };
}
