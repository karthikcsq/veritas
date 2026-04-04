import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const { studyId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Enrollments with per-enrollment aggregate scores ──
  const enrollmentsResult = await pool.query(
    `SELECT
      e."id",
      e."status",
      e."enrolledAt",
      e."completedAt",
      COALESCE(
        (SELECT AVG(qs."overallScore") FROM "Response" r
         JOIN "QualityScore" qs ON qs."responseId" = r."id"
         WHERE r."enrollmentId" = e."id"), NULL
      ) AS "avgOverall",
      COALESCE(
        (SELECT AVG(qs."coherenceScore") FROM "Response" r
         JOIN "QualityScore" qs ON qs."responseId" = r."id"
         WHERE r."enrollmentId" = e."id"), NULL
      ) AS "avgCoherence",
      COALESCE(
        (SELECT AVG(qs."effortScore") FROM "Response" r
         JOIN "QualityScore" qs ON qs."responseId" = r."id"
         WHERE r."enrollmentId" = e."id"), NULL
      ) AS "avgEffort",
      COALESCE(
        (SELECT AVG(qs."consistencyScore") FROM "Response" r
         JOIN "QualityScore" qs ON qs."responseId" = r."id"
         WHERE r."enrollmentId" = e."id"), NULL
      ) AS "avgConsistency",
      COALESCE(
        (SELECT bool_or(qs."flagged") FROM "Response" r
         JOIN "QualityScore" qs ON qs."responseId" = r."id"
         WHERE r."enrollmentId" = e."id"), false
      ) AS "hasFlaggedResponse",
      (SELECT string_agg(DISTINCT qs."flagReason", '; ')
       FROM "Response" r
       JOIN "QualityScore" qs ON qs."responseId" = r."id"
       WHERE r."enrollmentId" = e."id" AND qs."flagReason" IS NOT NULL
      ) AS "flagReasons"
    FROM "Enrollment" e
    WHERE e."studyId" = $1
    ORDER BY e."enrolledAt" ASC`,
    [studyId]
  );

  const enrollments = enrollmentsResult.rows.map((e) => ({
    id: e.id,
    status: e.status,
    enrolledAt: e.enrolledAt instanceof Date ? e.enrolledAt.toISOString() : e.enrolledAt,
    completedAt: e.completedAt instanceof Date ? e.completedAt?.toISOString() : e.completedAt ?? null,
    avgOverall: e.avgOverall !== null ? parseFloat(e.avgOverall) : null,
    avgCoherence: e.avgCoherence !== null ? parseFloat(e.avgCoherence) : null,
    avgEffort: e.avgEffort !== null ? parseFloat(e.avgEffort) : null,
    avgConsistency: e.avgConsistency !== null ? parseFloat(e.avgConsistency) : null,
    hasFlaggedResponse: e.hasFlaggedResponse,
    flagReasons: e.flagReasons ?? null,
  }));

  // ── Global dimension averages ──
  const dimResult = await pool.query(
    `SELECT
      AVG(qs."coherenceScore") AS "avgCoherence",
      AVG(qs."effortScore") AS "avgEffort",
      AVG(qs."consistencyScore") AS "avgConsistency",
      AVG(qs."overallScore") AS "avgOverall",
      COUNT(*) AS "totalScored"
    FROM "QualityScore" qs
    JOIN "Response" r ON r."id" = qs."responseId"
    JOIN "Enrollment" e ON e."id" = r."enrollmentId"
    WHERE e."studyId" = $1`,
    [studyId]
  );
  const dim = dimResult.rows[0];

  // ── Quality distribution ──
  const distResult = await pool.query(
    `SELECT
      COUNT(*) FILTER (WHERE sub."avg" >= 0.7) AS "high",
      COUNT(*) FILTER (WHERE sub."avg" >= 0.45 AND sub."avg" < 0.7) AS "moderate",
      COUNT(*) FILTER (WHERE sub."avg" < 0.45) AS "flagged"
    FROM (
      SELECT e."id", AVG(qs."overallScore") AS "avg"
      FROM "Enrollment" e
      JOIN "Response" r ON r."enrollmentId" = e."id"
      JOIN "QualityScore" qs ON qs."responseId" = r."id"
      WHERE e."studyId" = $1
      GROUP BY e."id"
    ) sub`,
    [studyId]
  );
  const dist = distResult.rows[0];

  // ── Enrollment trend (cumulative by date) ──
  const trendResult = await pool.query(
    `SELECT
      DATE(e."enrolledAt") AS "date",
      COUNT(*) AS "enrolled",
      COUNT(*) FILTER (WHERE e."status" = 'COMPLETED') AS "completed",
      COUNT(*) FILTER (WHERE e."status" = 'FLAGGED') AS "flagged"
    FROM "Enrollment" e
    WHERE e."studyId" = $1
    GROUP BY DATE(e."enrolledAt")
    ORDER BY DATE(e."enrolledAt") ASC`,
    [studyId]
  );

  let cumEnrolled = 0, cumCompleted = 0, cumFlagged = 0;
  const trend = trendResult.rows.map((row) => {
    cumEnrolled += parseInt(row.enrolled);
    cumCompleted += parseInt(row.completed);
    cumFlagged += parseInt(row.flagged);
    const d = new Date(row.date);
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      enrolled: cumEnrolled,
      completed: cumCompleted,
      flagged: cumFlagged,
    };
  });

  // ── Per-question stats ──
  const questionsResult = await pool.query(
    `SELECT
      q."id", q."order", q."type", q."prompt", q."options",
      COUNT(r."id") AS "responseCount",
      (SELECT COUNT(DISTINCT r2."enrollmentId") FROM "Response" r2 WHERE r2."questionId" = q."id")::float
        / NULLIF((SELECT COUNT(*) FROM "Enrollment" e2 WHERE e2."studyId" = $1), 0) * 100 AS "responseRate",
      AVG(qs."overallScore") AS "avgQuality"
    FROM "Question" q
    LEFT JOIN "Response" r ON r."questionId" = q."id"
    LEFT JOIN "QualityScore" qs ON qs."responseId" = r."id"
    WHERE q."studyId" = $1
    GROUP BY q."id", q."order", q."type", q."prompt", q."options"
    ORDER BY q."order" ASC`,
    [studyId]
  );

  // For scale questions, get the average value
  const scaleQuestionIds = questionsResult.rows
    .filter((q) => q.type === "SCALE")
    .map((q) => q.id);

  let scaleAvgs: Record<string, number> = {};
  if (scaleQuestionIds.length > 0) {
    const scaleResult = await pool.query(
      `SELECT r."questionId", AVG(CAST(r."value" AS float)) AS "avgValue"
       FROM "Response" r
       WHERE r."questionId" = ANY($1)
       GROUP BY r."questionId"`,
      [scaleQuestionIds]
    );
    for (const row of scaleResult.rows) {
      scaleAvgs[row.questionId] = parseFloat(row.avgValue);
    }
  }

  // For LONG_TEXT / SHORT_TEXT, get average word count
  const textQuestionIds = questionsResult.rows
    .filter((q) => q.type === "LONG_TEXT" || q.type === "SHORT_TEXT")
    .map((q) => q.id);

  let textAvgWords: Record<string, number> = {};
  if (textQuestionIds.length > 0) {
    const textResult = await pool.query(
      `SELECT r."questionId",
        AVG(array_length(string_to_array(trim(r."value"), ' '), 1)) AS "avgWords"
       FROM "Response" r
       WHERE r."questionId" = ANY($1)
       GROUP BY r."questionId"`,
      [textQuestionIds]
    );
    for (const row of textResult.rows) {
      textAvgWords[row.questionId] = Math.round(parseFloat(row.avgWords));
    }
  }

  // For MULTIPLE_CHOICE, get distribution
  const mcQuestionIds = questionsResult.rows
    .filter((q) => q.type === "MULTIPLE_CHOICE")
    .map((q) => q.id);

  let mcDistributions: Record<string, Record<string, number>> = {};
  if (mcQuestionIds.length > 0) {
    const mcResult = await pool.query(
      `SELECT r."questionId", r."value", COUNT(*) AS "cnt"
       FROM "Response" r
       WHERE r."questionId" = ANY($1)
       GROUP BY r."questionId", r."value"
       ORDER BY "cnt" DESC`,
      [mcQuestionIds]
    );
    for (const row of mcResult.rows) {
      if (!mcDistributions[row.questionId]) mcDistributions[row.questionId] = {};
      mcDistributions[row.questionId][row.value] = parseInt(row.cnt);
    }
  }

  const questions = questionsResult.rows.map((q) => {
    let stat = "";
    if (q.type === "SCALE" && scaleAvgs[q.id] !== undefined) {
      stat = `Avg response: ${scaleAvgs[q.id].toFixed(1)}`;
    } else if ((q.type === "LONG_TEXT" || q.type === "SHORT_TEXT") && textAvgWords[q.id] !== undefined) {
      stat = `Avg length: ${textAvgWords[q.id]} words`;
    } else if (q.type === "MULTIPLE_CHOICE" && mcDistributions[q.id]) {
      const entries = Object.entries(mcDistributions[q.id]);
      const total = entries.reduce((s, [, c]) => s + c, 0);
      if (entries.length > 0) {
        stat = `Top choice: ${entries[0][0]} (${Math.round((entries[0][1] / total) * 100)}%)`;
      }
    }

    return {
      id: q.id,
      order: q.order,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      responseCount: parseInt(q.responseCount),
      responseRate: q.responseRate !== null ? Math.round(parseFloat(q.responseRate)) : 0,
      avgQuality: q.avgQuality !== null ? parseFloat(q.avgQuality) : null,
      stat,
    };
  });

  // ── Per-enrollment response details (for integrity comparisons) ──
  const responsesResult = await pool.query(
    `SELECT
      r."enrollmentId",
      q."prompt" AS "question",
      r."value" AS "answer",
      qs."overallScore",
      qs."flagged",
      qs."flagReason"
    FROM "Response" r
    JOIN "Question" q ON q."id" = r."questionId"
    LEFT JOIN "QualityScore" qs ON qs."responseId" = r."id"
    JOIN "Enrollment" e ON e."id" = r."enrollmentId"
    WHERE e."studyId" = $1
    ORDER BY q."order" ASC`,
    [studyId]
  );

  const responsesByEnrollment: Record<
    string,
    Array<{ question: string; answer: string; score: number | null; flagged: boolean }>
  > = {};

  for (const row of responsesResult.rows) {
    if (!responsesByEnrollment[row.enrollmentId]) responsesByEnrollment[row.enrollmentId] = [];
    responsesByEnrollment[row.enrollmentId].push({
      question: row.question,
      answer: row.answer,
      score: row.overallScore !== null ? parseFloat(row.overallScore) : null,
      flagged: row.flagged ?? false,
    });
  }

  return NextResponse.json({
    enrollments,
    dimensions: {
      coherence: dim.avgCoherence ? Math.round(parseFloat(dim.avgCoherence) * 100) : 0,
      effort: dim.avgEffort ? Math.round(parseFloat(dim.avgEffort) * 100) : 0,
      consistency: dim.avgConsistency ? Math.round(parseFloat(dim.avgConsistency) * 100) : 0,
      overall: dim.avgOverall ? Math.round(parseFloat(dim.avgOverall) * 100) : 0,
    },
    qualityDistribution: {
      high: parseInt(dist.high),
      moderate: parseInt(dist.moderate),
      flagged: parseInt(dist.flagged),
    },
    trend,
    questions,
    responsesByEnrollment,
  });
}
