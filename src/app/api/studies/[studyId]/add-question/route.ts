import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool, generateId } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { studyId } = await params;
  const researcherId = (session.user as { id: string }).id;

  // Verify ownership
  const studyResult = await pool.query(
    'SELECT "id" FROM "Study" WHERE "id" = $1 AND "researcherId" = $2',
    [studyId, researcherId]
  );
  if (studyResult.rows.length === 0) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  const body = await req.json();
  const questionId = generateId();

  await pool.query(
    'INSERT INTO "Question" ("id", "studyId", "order", "type", "prompt", "options", "required", "config", "dependsOn") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [
      questionId,
      studyId,
      body.order ?? 999,
      body.type ?? "SCALE",
      body.prompt,
      body.options ? JSON.stringify(body.options) : null,
      body.required !== false,
      body.config ? JSON.stringify(body.config) : null,
      null,
    ]
  );

  return NextResponse.json({ questionId }, { status: 201 });
}
