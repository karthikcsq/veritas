import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const { studyId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studyResult = await pool.query(
    `SELECT "id", "title", "status", "targetCount" FROM "Study" WHERE "id" = $1`,
    [studyId]
  );
  if (!studyResult.rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const study = studyResult.rows[0];

  // Aggregate enrollment counts
  const statsResult = await pool.query(
    `SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed,
      COUNT(CASE WHEN status IN ('IN_PROGRESS', 'VERIFIED') THEN 1 END) AS in_progress,
      COUNT(CASE WHEN status = 'FLAGGED' THEN 1 END) AS flagged
    FROM "Enrollment" WHERE "studyId" = $1`,
    [studyId]
  );
  const s = statsResult.rows[0];

  // All quality + similarity scores for this study
  const scoresResult = await pool.query(
    `SELECT
      qs."overallScore", qs."coherenceScore", qs."effortScore",
      qs."consistencyScore", qs."similarityScore"
    FROM "QualityScore" qs
    JOIN "Response" r ON r."id" = qs."responseId"
    JOIN "Enrollment" e ON e."id" = r."enrollmentId"
    WHERE e."studyId" = $1`,
    [studyId]
  );

  const allScores = scoresResult.rows;
  const overallArr = allScores.map((r) => parseFloat(r.overallScore));
  const coherenceArr = allScores.filter((r) => r.coherenceScore !== null).map((r) => parseFloat(r.coherenceScore));
  const effortArr = allScores.filter((r) => r.effortScore !== null).map((r) => parseFloat(r.effortScore));
  const consistencyArr = allScores.filter((r) => r.consistencyScore !== null).map((r) => parseFloat(r.consistencyScore));
  const simArr = allScores.filter((r) => r.similarityScore !== null).map((r) => parseFloat(r.similarityScore));

  // Daily enrollment trend
  const trendResult = await pool.query(
    `SELECT
      DATE("enrolledAt") AS date,
      COUNT(*) AS enrolled,
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed,
      COUNT(CASE WHEN status = 'FLAGGED' THEN 1 END) AS flagged
    FROM "Enrollment"
    WHERE "studyId" = $1
    GROUP BY DATE("enrolledAt")
    ORDER BY DATE("enrolledAt")`,
    [studyId]
  );

  // Per-enrollment aggregated scores + flag info
  const enrollmentsResult = await pool.query(
    `SELECT
      e."id", e."status",
      AVG(qs."overallScore")     AS overall,
      AVG(qs."coherenceScore")   AS coherence,
      AVG(qs."effortScore")      AS effort,
      AVG(qs."consistencyScore") AS consistency,
      AVG(qs."similarityScore")  AS similarity,
      BOOL_OR(qs."flagged")      AS flagged,
      STRING_AGG(DISTINCT qs."flagReason", '; ' ORDER BY qs."flagReason") AS flag_reason,
      STRING_AGG(DISTINCT qs."similarityReason", '; ' ORDER BY qs."similarityReason") AS similarity_reason
    FROM "Enrollment" e
    LEFT JOIN "Response" r ON r."enrollmentId" = e."id"
    LEFT JOIN "QualityScore" qs ON qs."responseId" = r."id"
    WHERE e."studyId" = $1
    GROUP BY e."id", e."status"
    ORDER BY e."id"`,
    [studyId]
  );

  // Individual responses with question details
  const responsesResult = await pool.query(
    `SELECT
      r."id", r."enrollmentId", r."questionId", r."value", r."timeSpentMs",
      q."prompt", q."type"
    FROM "Response" r
    JOIN "Question" q ON q."id" = r."questionId"
    JOIN "Enrollment" e ON e."id" = r."enrollmentId"
    WHERE e."studyId" = $1`,
    [studyId]
  );

  const responsesByEnrollment: Record<string, object[]> = {};
  for (const r of responsesResult.rows) {
    if (!responsesByEnrollment[r.enrollmentId]) responsesByEnrollment[r.enrollmentId] = [];
    responsesByEnrollment[r.enrollmentId].push({
      questionId: r.questionId,
      questionPrompt: r.prompt,
      questionType: r.type,
      value: r.value ?? "",
      timeSpentMs: r.timeSpentMs ? parseInt(r.timeSpentMs) : null,
      wordCount: r.value ? r.value.split(/\s+/).filter(Boolean).length : 0,
    });
  }

  // Per-question aggregate stats
  const questionStatsResult = await pool.query(
    `SELECT
      q."id", q."order", q."type", q."prompt", q."options",
      COUNT(r."id")              AS response_count,
      AVG(r."timeSpentMs")       AS avg_time_ms,
      AVG(qs."overallScore")     AS avg_quality,
      AVG(qs."similarityScore")  AS avg_similarity
    FROM "Question" q
    LEFT JOIN "Response" r ON r."questionId" = q."id"
      AND EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."id" = r."enrollmentId" AND e."studyId" = $1)
    LEFT JOIN "QualityScore" qs ON qs."responseId" = r."id"
    WHERE q."studyId" = $1
    GROUP BY q."id", q."order", q."type", q."prompt", q."options"
    ORDER BY q."order"`,
    [studyId]
  );

  const totalEnrollments = parseInt(s.total, 10);

  return NextResponse.json({
    study: {
      id: study.id,
      title: study.title,
      status: study.status,
      targetCount: study.targetCount,
    },
    stats: {
      totalEnrollments,
      completed: parseInt(s.completed, 10),
      inProgress: parseInt(s.in_progress, 10),
      flagged: parseInt(s.flagged, 10),
      averageQualityScore: Math.round(avg(overallArr) * 100) / 100,
      averageSimilarityScore: simArr.length ? Math.round(avg(simArr) * 100) / 100 : null,
      qualityDistribution: {
        high: overallArr.filter((v) => v >= 0.7).length,
        medium: overallArr.filter((v) => v >= 0.45 && v < 0.7).length,
        low: overallArr.filter((v) => v < 0.45).length,
      },
    },
    enrollmentTrend: trendResult.rows.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
      enrolled: parseInt(r.enrolled, 10),
      completed: parseInt(r.completed, 10),
      flagged: parseInt(r.flagged, 10),
    })),
    dimensionScores: {
      coherence: Math.round(avg(coherenceArr) * 100),
      effort: Math.round(avg(effortArr) * 100),
      consistency: Math.round(avg(consistencyArr) * 100),
      similarity: simArr.length ? Math.round(avg(simArr) * 100) : null,
    },
    enrollments: enrollmentsResult.rows.map((e) => ({
      id: e.id,
      status: e.status,
      overallScore: e.overall !== null ? Math.round(parseFloat(e.overall) * 100) / 100 : null,
      coherenceScore: e.coherence !== null ? Math.round(parseFloat(e.coherence) * 100) / 100 : null,
      effortScore: e.effort !== null ? Math.round(parseFloat(e.effort) * 100) / 100 : null,
      consistencyScore: e.consistency !== null ? Math.round(parseFloat(e.consistency) * 100) / 100 : null,
      similarityScore: e.similarity !== null ? Math.round(parseFloat(e.similarity) * 100) / 100 : null,
      flagged: e.flagged ?? false,
      flagReason: e.flag_reason ?? null,
      similarityReason: e.similarity_reason ?? null,
      responses: (responsesByEnrollment[e.id] ?? []) as {
        questionId: string;
        questionPrompt: string;
        questionType: string;
        value: string;
        timeSpentMs: number | null;
        wordCount: number;
      }[],
    })),
    questionStats: questionStatsResult.rows.map((q) => ({
      questionId: q.id,
      order: parseInt(q.order, 10),
      type: q.type,
      prompt: q.prompt,
      options: q.options ?? null,
      responseCount: parseInt(q.response_count, 10),
      totalEnrollments,
      avgTimeSec: q.avg_time_ms !== null ? Math.round(parseFloat(q.avg_time_ms) / 1000) : null,
      avgQuality: q.avg_quality !== null ? Math.round(parseFloat(q.avg_quality) * 100) / 100 : null,
      avgSimilarity: q.avg_similarity !== null ? Math.round(parseFloat(q.avg_similarity) * 100) / 100 : null,
    })),
  });
}
