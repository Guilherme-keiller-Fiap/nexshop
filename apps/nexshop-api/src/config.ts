export type AppConfig = {
    sensitivity: number;
    trustedIps: string[];
    blockedIps: string[];
    trustedEmailHashes: string[];
    blockedEmailHashes: string[];
    trustedUserIds: string[];
    blockedUserIds: string[];
    reviewMinScore: number;
    callbackUrl?: string;
    callbackSecret?: string;
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
    trustedEmailHashes: parseList(process.env.TRUSTED_EMAIL_HASHES),
    blockedEmailHashes: parseList(process.env.BLOCKED_EMAIL_HASHES),
    trustedUserIds: parseList(process.env.TRUSTED_USER_IDS),
    blockedUserIds: parseList(process.env.BLOCKED_USER_IDS),
    reviewMinScore: Number(process.env.REVIEW_MIN_SCORE ?? 50),
    callbackUrl: process.env.CALLBACK_URL,
    callbackSecret: process.env.CALLBACK_SECRET
};
