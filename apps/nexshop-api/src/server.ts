import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { createVerifyMiddleware } from "./middleware/identity.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { apiKey } from "./middleware/apiKey.js";

const app = express();
const origins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(helmet());
app.use(cors({ origin: origins, credentials: false }));
app.use(express.json({ limit: "100kb" }));

app.get("/", (_req, res) => res.status(200).send("nexshop-api"));
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

app.post(
  "/identity/verify",
  apiKey(),
  rateLimit({ windowMs: 60_000, max: 20 }),
  createVerifyMiddleware({ sensitivity: 0.5 })
);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`nexshop-api listening at http://localhost:${port}`);
});
