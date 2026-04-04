import { NextResponse } from "next/server";
import { checkContradictions } from "@/lib/scorer";
import type { CheckContradictionsRequest } from "@/types";

export async function POST(req: Request) {
  try {
    const body: CheckContradictionsRequest = await req.json();

    if (!body.responses || body.responses.length < 2) {
      return NextResponse.json(
        { error: "At least 2 responses are required to check for contradictions" },
        { status: 400 }
      );
    }

    const result = await checkContradictions(body.responses);

    return NextResponse.json(result);
  } catch (e) {
    console.error("Contradiction check failed:", e);
    return NextResponse.json(
      { error: "Contradiction check failed" },
      { status: 500 }
    );
  }
}
