import { Router } from "express";
import { getResult } from "../core/jobs.js";

export const resultRouter = Router();

resultRouter.get("/identity/result/:id", (req, res) => {
    const id = req.params.id;
    const r = getResult(id);
    if (!r) {
        res.status(202).json({ status: "processing", requestId: id });
        return;
    }
    res.status(200).json(r);
});
