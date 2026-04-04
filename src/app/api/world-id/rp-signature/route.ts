import { NextResponse } from "next/server";
import { generateRpSignature, getWorldIdPublicConfig } from "@/lib/worldid";

interface RpSignatureRequest {
  action?: string;
}

export async function POST(req: Request) {
  try {
    const body: RpSignatureRequest = await req.json();
    const action = body.action?.trim();

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    const rpSignature = generateRpSignature(action);
    const { appId, rpId } = getWorldIdPublicConfig();

    return NextResponse.json({
      app_id: appId,
      rp_id: rpId,
      ...rpSignature,
    });
  } catch (error) {
    console.error("Failed to generate RP signature", error);
    return NextResponse.json(
      { error: "Failed to generate RP signature" },
      { status: 500 }
    );
  }
}
