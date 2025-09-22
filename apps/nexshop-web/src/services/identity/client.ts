import { initSDK as _initSDK } from "@nexshop/nexid-sdk";
import type { VerifyResponse } from "@nexshop/nexid-sdk";
import { IDENTITY_ENDPOINT, IDENTITY_API_KEY } from "./config";

export const initSDK = _initSDK;

const sdk = _initSDK({ endpoint: IDENTITY_ENDPOINT, apiKey: IDENTITY_API_KEY });

export async function verifyIdentity(p: {
  context: "login" | "checkout" | "sensitive";
  emailHash?: string;
  userId?: string;
  async?: boolean;
}): Promise<VerifyResponse> {
  const r = await sdk.verify(
    { context: p.context, emailHash: p.emailHash, userId: p.userId },
    { async: !!p.async }
  );
  if (r.status === "processing") {
    return sdk.poll(r.requestId, { intervalMs: 700, timeoutMs: 10000 });
  }
  return r;
}
