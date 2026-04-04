import { NextResponse } from "next/server";
import { checkResponseValidity } from "@/lib/scorer";
import type { ValidateResponseRequest } from "@/types";

export async function POST(req: Request) {
  try {
    const body: ValidateResponseRequest = await req.json();

    if (!body.question || !body.answer || !body.questionType) {
      return NextResponse.json(
        { error: "Missing required fields: question, answer, questionType" },
        { status: 400 }
      );
    }

    const result = await checkResponseValidity(
      body.question,
      body.answer,
      body.questionType
    );

    return NextResponse.json(result);
  } catch (e) {
    console.error("Validity check failed:", e);
    return NextResponse.json(
      { error: "Validity check failed" },
      { status: 500 }
    );
  }
}
