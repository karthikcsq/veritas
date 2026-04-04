import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool, generateId } from "@/lib/db";
import { triggerScoringPipeline } from "@/lib/scorer";
import type { SubmitResponsesRequest } from "@/types";

// POST — participant submits responses (no auth, identified by enrollmentId)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  const { enrollmentId } = await params;
  const body: SubmitResponsesRequest = await req.json();

  const enrollmentResult = await pool.query(
    'SELECT "id" FROM "Enrollment" WHERE "id" = $1',
    [enrollmentId]
  );
  if (enrollmentResult.rows.length === 0) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    );
  }

  // Save all responses in a transaction
  const client = await pool.connect();
  const responseIds: string[] = [];
  try {
    await client.query("BEGIN");

    for (const r of body.responses) {
      const id = generateId();
      await client.query(
        'INSERT INTO "Response" ("id", "enrollmentId", "questionId", "value", "timeSpentMs", "submittedAt") VALUES ($1, $2, $3, $4, $5, NOW())',
        [id, enrollmentId, r.questionId, r.value, r.timeSpentMs]
      );
      responseIds.push(id);
    }

    // Update enrollment status
    await client.query(
      'UPDATE "Enrollment" SET "status" = $1 WHERE "id" = $2',
      ["IN_PROGRESS", enrollmentId]
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  // Fire and forget — scoring runs in background
  triggerScoringPipeline(enrollmentId, responseIds).catch(console.error);

  return NextResponse.json(
    {
      message: "Responses submitted. Quality scoring in progress.",
      enrollmentId: enrollmentId,
    },
    { status: 201 }
  );
}

// GET — researcher views responses with quality scores
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  const { enrollmentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await pool.query(
    `SELECT
      r."questionId",
      q."prompt" AS "questionPrompt",
      r."value",
      r."timeSpentMs",
      qs."overallScore",
      qs."coherenceScore",
      qs."effortScore",
      qs."consistencyScore",
      qs."flagged",
      qs."flagReason"
    FROM "Response" r
    JOIN "Question" q ON q."id" = r."questionId"
    LEFT JOIN "QualityScore" qs ON qs."responseId" = r."id"
    WHERE r."enrollmentId" = $1
    ORDER BY q."order" ASC`,
    [enrollmentId]
  );

  return NextResponse.json({
    responses: result.rows.map((r) => ({
      questionId: r.questionId,
      questionPrompt: r.questionPrompt,
      value: r.value,
      timeSpentMs: r.timeSpentMs,
      qualityScore: r.overallScore != null
        ? {
            overallScore: parseFloat(r.overallScore),
            coherenceScore: parseFloat(r.coherenceScore),
            effortScore: parseFloat(r.effortScore),
            consistencyScore: parseFloat(r.consistencyScore),
            flagged: r.flagged,
            flagReason: r.flagReason,
          }
        : null,
    })),
  });
}
