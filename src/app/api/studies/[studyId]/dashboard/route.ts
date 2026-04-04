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

  // Get enrollment stats
  const statsResult = await pool.query(
    `SELECT
      COUNT(*) AS "totalEnrollments",
      COUNT(CASE WHEN "status" = 'COMPLETED' THEN 1 END) AS "completed",
      COUNT(CASE WHEN "status" IN ('IN_PROGRESS', 'VERIFIED') THEN 1 END) AS "inProgress",
      COUNT(CASE WHEN "status" = 'FLAGGED' THEN 1 END) AS "flagged"
    FROM "Enrollment"
    WHERE "studyId" = $1`,
    [studyId]
  );
  const stats = statsResult.rows[0];

  // Get all quality scores for this study
  const scoresResult = await pool.query(
    `SELECT qs."overallScore"
    FROM "QualityScore" qs
    JOIN "Response" r ON r."id" = qs."responseId"
    JOIN "Enrollment" e ON e."id" = r."enrollmentId"
    WHERE e."studyId" = $1`,
    [studyId]
  );

  const allScores = scoresResult.rows.map((r) => parseFloat(r.overallScore));
  const averageQualityScore =
    allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0;

  const high = allScores.filter((s) => s >= 0.7).length;
  const medium = allScores.filter((s) => s >= 0.45 && s < 0.7).length;
  const low = allScores.filter((s) => s < 0.45).length;

  // Get recent enrollments
  const recentResult = await pool.query(
    `SELECT "id", "status", "enrolledAt"
    FROM "Enrollment"
    WHERE "studyId" = $1
    ORDER BY "enrolledAt" DESC
    LIMIT 10`,
    [studyId]
  );

  return NextResponse.json({
    stats: {
      totalEnrollments: parseInt(stats.totalEnrollments, 10),
      completed: parseInt(stats.completed, 10),
      inProgress: parseInt(stats.inProgress, 10),
      flagged: parseInt(stats.flagged, 10),
      averageQualityScore: Math.round(averageQualityScore * 100) / 100,
      qualityDistribution: { high, medium, low },
    },
    recentEnrollments: recentResult.rows.map((e) => ({
      id: e.id,
      status: e.status,
      enrolledAt: e.enrolledAt instanceof Date ? e.enrolledAt.toISOString() : e.enrolledAt,
    })),
  });
}
