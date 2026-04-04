import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function PATCH(
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

  const { questionOrder, prompt } = await req.json();

  const result = await pool.query(
    'UPDATE "Question" SET "prompt" = $1 WHERE "studyId" = $2 AND "order" = $3 RETURNING "id", "prompt"',
    [prompt, studyId, questionOrder]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  return NextResponse.json({ question: result.rows[0] });
}
