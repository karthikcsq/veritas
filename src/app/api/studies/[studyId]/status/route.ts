import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { detectAndStoreReversePairs, recommendReverseQuestions } from "@/lib/quality";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const { studyId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { status } = await req.json();

  if (!["DRAFT", "ACTIVE", "CLOSED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // On publish: detect reverse pairs + recommend if needed, BEFORE setting ACTIVE
  if (status === "ACTIVE") {
    const questionsResult = await pool.query(
      `SELECT "prompt", "type", "options", "config"
       FROM "Question" WHERE "studyId" = $1 ORDER BY "order"`,
      [studyId]
    );
    const questions = questionsResult.rows;

    // Step 1: Detect existing natural reverse pairs
    let storedPairs: Awaited<ReturnType<typeof detectAndStoreReversePairs>> = [];
    try {
      storedPairs = await detectAndStoreReversePairs(studyId);
    } catch (err) {
      console.error("Reverse pair detection failed:", err);
    }

    // Step 2: If < 2 pairs, generate recommendations and return them
    // The study still gets published, but the response includes suggestions
    let recommendations: Awaited<ReturnType<typeof recommendReverseQuestions>>["recommendations"] = [];
    if (storedPairs.length < 2 && questions.length >= 5) {
      try {
        const result = await recommendReverseQuestions(questions);
        recommendations = result.recommendations;
      } catch (err) {
        console.error("Reverse recommendation failed:", err);
      }
    }

    // Publish the study
    const updateResult = await pool.query(
      'UPDATE "Study" SET "status" = $1, "updatedAt" = NOW() WHERE "id" = $2 RETURNING "id", "status"',
      [status, studyId]
    );
    const study = updateResult.rows[0];

    return NextResponse.json({
      study: { id: study.id, status: study.status },
      qualityAnalysis: {
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
              ? `Only ${storedPairs.length} reverse pair(s) detected. Consider adding these ${recommendations.length} question(s) for better quality detection.`
              : `${storedPairs.length} reverse pair(s) detected.`,
      },
    });
  }

  // For non-publish status changes (DRAFT, CLOSED), just update
  const result = await pool.query(
    'UPDATE "Study" SET "status" = $1, "updatedAt" = NOW() WHERE "id" = $2 RETURNING "id", "status"',
    [status, studyId]
  );
  const study = result.rows[0];

  return NextResponse.json({
    study: { id: study.id, status: study.status },
  });
}
