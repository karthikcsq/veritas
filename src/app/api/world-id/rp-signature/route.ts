// Step 3: Generate an RP signature in your backend
// https://docs.world.org/world-id/idkit#step-3-generate-an-rp-signature-in-your-backend
import { signRequest } from "@worldcoin/idkit/signing";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SIGNING_KEY = process.env.RP_SIGNING_KEY;
const RP_ID = process.env.WORLD_RP_ID;

export async function POST(request: Request): Promise<Response> {
  if (!SIGNING_KEY) {
    return NextResponse.json(
      { error: "RP_SIGNING_KEY not configured" },
      { status: 500 },
    );
  }
  if (!RP_ID) {
    return NextResponse.json(
      { error: "WORLD_RP_ID not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json()) as { action?: unknown };
  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  const sig = signRequest(action, SIGNING_KEY);

  return NextResponse.json({
    rp_id: RP_ID,
    sig: sig.sig,
    nonce: sig.nonce,
    created_at: sig.createdAt,
    expires_at: sig.expiresAt,
  });
}
