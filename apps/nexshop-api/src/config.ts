export type AppConfig = {
    sensitivity: number;
    trustedIps: string[];
    blockedIps: string[];
    reviewMinScore: number;
};

function parseList(v: string | undefined) {
return (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const cfg: AppConfig = {
    sensitivity: Number(process.env.RISK_SENSITIVITY ?? 0.5),
    trustedIps: parseList(process.env.TRUSTED_IPS),
    blockedIps: parseList(process.env.BLOCKED_IPS),
    reviewMinScore: Number(process.env.REVIEW_MIN_SCORE ?? 50)
};
