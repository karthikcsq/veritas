import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

interface OnboardingRequest {
  name?: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const researcherId = (session?.user as { id?: string } | undefined)?.id;

  if (!researcherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: OnboardingRequest = await req.json();
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  await pool.query(
    'UPDATE "Researcher" SET "name" = $1 WHERE "id" = $2',
    [name, researcherId]
  );

  return NextResponse.json({ success: true });
}
