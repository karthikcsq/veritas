// Nullifier extraction helper — matches IDKit response shape from docs
// https://docs.world.org/world-id/idkit#idkit-response

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
