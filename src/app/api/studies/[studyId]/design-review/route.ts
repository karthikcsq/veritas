import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { recommendReverseQuestions } from "@/lib/quality";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { studyId } = await params;

  const researcherId = (session.user as { id: string }).id;
  const studyResult = await pool.query(
    'SELECT "id", "title", "status" FROM "Study" WHERE "id" = $1 AND "researcherId" = $2',
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

  const questions = questionsResult.rows;

  // Check for stored pairs if study is already published
  const pairsResult = await pool.query(
    'SELECT COUNT(*) AS count FROM "ReversePair" WHERE "studyId" = $1',
    [studyId]
  );
  const existingPairCount = parseInt(pairsResult.rows[0].count, 10);

  // Generate recommendations if study is still in draft
  let recommendations: Awaited<ReturnType<typeof recommendReverseQuestions>> = [];
  if (studyResult.rows[0].status === "DRAFT" && questions.length >= 5) {
    recommendations = await recommendReverseQuestions(questions);
  }

  return NextResponse.json({
    studyId,
    studyTitle: studyResult.rows[0].title,
    questionCount: questions.length,
    existingReversePairs: existingPairCount,
    recommendations,
    summary:
      existingPairCount > 0
        ? `Study has ${existingPairCount} reverse-scored pair(s) for quality detection.`
        : recommendations.length > 0
          ? `Consider adding ${recommendations.length} reverse-scored question(s) before publishing.`
          : questions.length < 5
            ? "Add more questions to get design recommendations."
            : "Survey design looks adequate.",
  });
}
