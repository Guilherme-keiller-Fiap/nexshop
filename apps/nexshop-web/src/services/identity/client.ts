import { initSDK, type VerifyResponse } from "@nexshop/nexid-sdk";
import { IDENTITY_ENDPOINT, IDENTITY_API_KEY } from "./config";

const sdk = initSDK({ endpoint: IDENTITY_ENDPOINT, apiKey: IDENTITY_API_KEY });

export async function verifyIdentity(params: {
  context: "login" | "checkout" | "sensitive";
  emailHash?: string;
  userId?: string;
  async?: boolean;
}): Promise<VerifyResponse> {
  const r = await sdk.verify(
    { context: params.context, emailHash: params.emailHash, userId: params.userId },
    { async: !!params.async }
  );
  if (r.status === "processing") {
    const final = await sdk.poll(r.requestId, { intervalMs: 700, timeoutMs: 7000 });
    return final;
  }
  return r;
}
