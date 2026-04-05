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

  // Fetch study
  const studyResult = await pool.query(
    'SELECT "id", "title", "description", "status", "targetCount", "compensationUsd" FROM "Study" WHERE "id" = $1',
    [studyId]
  );
  const study = studyResult.rows[0];

  if (!study) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  // Fetch questions
  const questionsResult = await pool.query(
    'SELECT "id", "order", "type", "prompt", "options", "required", "config", "dependsOn" FROM "Question" WHERE "studyId" = $1 ORDER BY "order" ASC',
    [studyId]
  );

  // Fetch enrollments with their responses and quality scores
  const enrollmentsResult = await pool.query(
    `SELECT
      e."id",
      e."status",
      e."enrolledAt",
      COALESCE(
        (SELECT AVG(qs."overallScore")
         FROM "Response" r
         JOIN "QualityScore" qs ON qs."responseId" = r."id"
         WHERE r."enrollmentId" = e."id"),
        NULL
      ) AS "averageQualityScore"
    FROM "Enrollment" e
    WHERE e."studyId" = $1`,
    [studyId]
  );

  return NextResponse.json({
    study: {
      id: study.id,
      title: study.title,
      description: study.description,
      status: study.status,
      targetCount: study.targetCount,
      compensationUsd: study.compensationUsd,
      questions: questionsResult.rows,
      enrollments: enrollmentsResult.rows.map((e) => ({
        id: e.id,
        status: e.status,
        enrolledAt: e.enrolledAt instanceof Date ? e.enrolledAt.toISOString() : e.enrolledAt,
        averageQualityScore: e.averageQualityScore !== null ? parseFloat(e.averageQualityScore) : null,
        flagged: e.status === "FLAGGED",
      })),
    },
  });
}
