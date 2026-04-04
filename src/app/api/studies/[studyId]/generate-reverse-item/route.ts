import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { recommendReverseQuestions } from "@/lib/quality";

// POST — recommend reverse-scored attention checks for a study being created/edited
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
  const studyResult = await pool.query(
    'SELECT "id" FROM "Study" WHERE "id" = $1 AND "researcherId" = $2',
    [studyId, researcherId]
  );
  if (studyResult.rows.length === 0) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  const questionsResult = await pool.query(
    `SELECT "prompt", "type", "options", "config"
     FROM "Question" WHERE "studyId" = $1 ORDER BY "order"`,
    [studyId]
  );

  if (questionsResult.rows.length < 5) {
    return NextResponse.json({
      studyId,
      recommendations: [],
      message: "Add at least 5 questions before requesting reverse-scored recommendations.",
    });
  }

  const items = await recommendReverseQuestions(questionsResult.rows);

  return NextResponse.json({
    studyId,
    recommendations: items,
    message: items.length > 0
      ? `We recommend adding ${items.length} reverse-scored attention check(s) to improve data quality. Review these suggestions and add them to your survey.`
      : "Your survey already appears to have adequate attention checks.",
  });
}

// GET — check stored reverse pairs for a published study
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { studyId } = await params;

  const pairsResult = await pool.query(
    `SELECT rp."id", rp."construct", rp."relationship",
            qa."prompt" AS "questionAPrompt", qb."prompt" AS "questionBPrompt"
     FROM "ReversePair" rp
     JOIN "Question" qa ON qa."id" = rp."questionAId"
     JOIN "Question" qb ON qb."id" = rp."questionBId"
     WHERE rp."studyId" = $1`,
    [studyId]
  );

  return NextResponse.json({
    studyId,
    reversePairs: pairsResult.rows,
  });
}
