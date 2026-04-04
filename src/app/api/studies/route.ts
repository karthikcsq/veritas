import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool, generateId } from "@/lib/db";
import { detectAndStoreReversePairs, recommendReverseQuestions } from "@/lib/quality";
import type { CreateStudyRequest } from "@/types";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: CreateStudyRequest = await req.json();
  const researcherId = (session.user as { id: string }).id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const studyId = generateId();
    const studyResult = await client.query(
      'INSERT INTO "Study" ("id", "researcherId", "title", "description", "status", "publiclyListed", "targetCount", "compensationUsd", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING "id", "title", "status"',
      [studyId, researcherId, body.title, body.description, "DRAFT", body.publiclyListed ?? false, body.targetCount, body.compensationUsd]
    );
    const study = studyResult.rows[0];

    for (const q of body.questions) {
      const questionId = generateId();
      await client.query(
        'INSERT INTO "Question" ("id", "studyId", "order", "type", "prompt", "options", "required", "config", "dependsOn") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [
          questionId,
          studyId,
          q.order,
          q.type,
          q.prompt,
          q.options ? JSON.stringify(q.options) : null,
          q.required !== false,
          q.config ? JSON.stringify(q.config) : null,
          q.dependsOn ? JSON.stringify(q.dependsOn) : null,
        ]
      );
    }

    await client.query("COMMIT");

    // After study is created, detect reverse pairs and recommend if needed
    let qualityAnalysis = null;
    try {
      const storedPairs = await detectAndStoreReversePairs(studyId);
      let recommendations: Awaited<ReturnType<typeof recommendReverseQuestions>>["recommendations"] = [];
      if (storedPairs.length < 2 && body.questions.length >= 5) {
        const result = await recommendReverseQuestions(
          body.questions.map((q) => ({
            prompt: q.prompt,
            type: q.type,
            options: q.options ?? null,
            config: q.config ?? null,
          }))
        );
        recommendations = result.recommendations;
      }
      qualityAnalysis = {
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
              ? `Only ${storedPairs.length} natural reverse pair(s) found. Consider adding ${recommendations.length} suggested question(s) for better quality detection.`
              : `${storedPairs.length} reverse pair(s) detected.`,
      };
    } catch (err) {
      console.error("Quality analysis on create failed (non-fatal):", err);
    }

    return NextResponse.json(
      {
        study: {
          id: study.id,
          title: study.title,
          status: study.status,
          worldIdAction: `study_enrollment_${study.id}`,
        },
        qualityAnalysis,
      },
      { status: 201 }
    );
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const researcherId = (session.user as { id: string }).id;

  const result = await pool.query(
    `SELECT
      s."id",
      s."title",
      s."status",
      s."targetCount",
      COUNT(e."id") AS "enrollmentCount",
      COUNT(CASE WHEN e."status" = 'COMPLETED' THEN 1 END) AS "completedCount",
      COUNT(CASE WHEN e."status" = 'FLAGGED' THEN 1 END) AS "flaggedCount"
    FROM "Study" s
    LEFT JOIN "Enrollment" e ON e."studyId" = s."id"
    WHERE s."researcherId" = $1
    GROUP BY s."id", s."title", s."status", s."targetCount", s."createdAt"
    ORDER BY s."createdAt" DESC`,
    [researcherId]
  );

  return NextResponse.json({
    studies: result.rows.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      targetCount: s.targetCount,
      enrollmentCount: parseInt(s.enrollmentCount, 10),
      completedCount: parseInt(s.completedCount, 10),
      flaggedCount: parseInt(s.flaggedCount, 10),
    })),
  });
}
