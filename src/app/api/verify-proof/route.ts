// Step 5: Verify the proof in your backend
// https://docs.world.org/world-id/idkit#step-5-verify-the-proof-in-your-backend
import type { IDKitResult } from "@worldcoin/idkit";
import { NextRequest, NextResponse } from "next/server";
import { pool, generateId } from "@/lib/db";

export async function POST(req: NextRequest) {
  const expectedRpId = process.env.WORLD_RP_ID;
  if (!expectedRpId) {
    return NextResponse.json(
      { error: "WORLD_RP_ID not configured" },
      { status: 500 },
    );
  }

  const { rp_id, idkitResponse } = (await req.json()) as {
    rp_id?: string;
    idkitResponse?: IDKitResult;
  };

  if (rp_id !== expectedRpId) {
    return NextResponse.json({ error: "Invalid rp_id" }, { status: 400 });
  }

  if (!idkitResponse) {
    return NextResponse.json(
      { error: "idkitResponse is required" },
      { status: 400 },
    );
  }

  const response = await fetch(
    `https://developer.world.org/api/v4/verify/${encodeURIComponent(expectedRpId)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(idkitResponse),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: "Verification failed", detail },
      { status: 400 },
    );
  }

  // Step 6: Store the nullifier
  // https://docs.world.org/world-id/idkit#step-6-store-the-nullifier
  const payload = idkitResponse as unknown as {
    action?: string;
    responses?: Array<{ nullifier?: string }>;
  };

  const nullifier = payload?.responses?.[0]?.nullifier;
  const action = payload?.action ?? "unknown";

  if (!nullifier) {
    return NextResponse.json(
      { error: "Missing nullifier in proof" },
      { status: 400 },
    );
  }

  // Store the nullifier
  try {
    const id = generateId();
    await pool.query(
      'INSERT INTO "Nullifier" ("id", "nullifier", "action", "verifiedAt") VALUES ($1, $2, $3, NOW())',
      [id, nullifier.toLowerCase(), action]
    );
  } catch (e: unknown) {
    // 23505 = unique constraint violation (already verified)
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505") {
      return NextResponse.json(
        { error: "This identity has already been verified for this action" },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.json({
    success: true,
    nullifier: nullifier.toLowerCase(),
  });
}
