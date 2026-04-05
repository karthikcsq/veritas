import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { detectAndStoreReversePairs, recommendReverseQuestions } from "@/lib/quality";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { studyId } = await params;

  const questions = await pool.query(
    'SELECT "prompt", "type", "options", "config" FROM "Question" WHERE "studyId" = $1 ORDER BY "order"',
    [studyId]
  );

  const storedPairs = await detectAndStoreReversePairs(studyId);

  let recommendations: Awaited<ReturnType<typeof recommendReverseQuestions>>["recommendations"] = [];
  if (storedPairs.length < 2 && questions.rows.length >= 5) {
    const result = await recommendReverseQuestions(questions.rows);
    recommendations = result.recommendations;
  }

  return NextResponse.json({
    reversePairsDetected: storedPairs.length,
    reversePairs: storedPairs.map((p) => ({
      construct: p.construct,
      relationship: p.relationship,
    })),
    recommendations,
    message:
      storedPairs.length >= 2
        ? `${storedPairs.length} reverse-scored pairs detected — quality checks are active.`
        : recommendations.length > 0
          ? `Only ${storedPairs.length} natural reverse pair(s) found. Consider adding ${recommendations.length} suggested question(s).`
          : `${storedPairs.length} reverse pair(s) detected.`,
  });
}
