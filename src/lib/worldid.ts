import { signRequest } from "@worldcoin/idkit/signing";

interface WorldIdConfig {
  appId: string;
  rpId: string;
  signingKey: string;
}

export interface RpSignature {
  sig: string;
  nonce: string;
  created_at: number;
  expires_at: number;
}

function getWorldIdConfig(): WorldIdConfig {
  const appId = process.env.WORLD_APP_ID;
  const rpId = process.env.WORLD_RP_ID;
  const signingKey = process.env.RP_SIGNING_KEY;

  if (!appId || !rpId || !signingKey) {
    throw new Error("WORLD_APP_ID, WORLD_RP_ID, and RP_SIGNING_KEY must be set");
  }

  return { appId, rpId, signingKey };
}

export function getWorldIdPublicConfig() {
  const { appId, rpId } = getWorldIdConfig();
  return { appId, rpId };
}

export function generateRpSignature(action: string): RpSignature {
  const { signingKey } = getWorldIdConfig();
  const normalizedKey = signingKey.trim();

  if (!normalizedKey) {
    throw new Error("RP_SIGNING_KEY is empty");
  }

  const { sig, nonce, createdAt, expiresAt } = signRequest(action, normalizedKey);

  return {
    sig,
    nonce,
    created_at: createdAt,
    expires_at: expiresAt,
  };
}

export async function verifyIdKitPayload(payload: unknown): Promise<Response> {
  const { rpId } = getWorldIdConfig();
  return fetch(`https://developer.world.org/api/v4/verify/${rpId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

type IdKitResponseWithNullifier = {
  responses?: Array<{
    nullifier?: string;
  }>;
};

export function extractNullifierFromIdKitPayload(payload: unknown): string | null {
  const typedPayload = payload as IdKitResponseWithNullifier;
  const nullifier = typedPayload?.responses?.[0]?.nullifier;
  return typeof nullifier === "string" && nullifier.length > 0 ? nullifier : null;
}
