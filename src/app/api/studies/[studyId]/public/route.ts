import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const { studyId } = await params;

  const studyResult = await pool.query(
    'SELECT "id", "title", "description", "compensationUsd", "status" FROM "Study" WHERE "id" = $1',
    [studyId]
  );
  const study = studyResult.rows[0];

  if (!study || study.status !== "ACTIVE") {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  const countResult = await pool.query(
    'SELECT COUNT(*) AS "questionCount" FROM "Question" WHERE "studyId" = $1',
    [studyId]
  );
  const questionCount = parseInt(countResult.rows[0].questionCount, 10);

  return NextResponse.json({
    study: {
      id: study.id,
      title: study.title,
      description: study.description,
      compensationUsd: study.compensationUsd,
      questionCount,
      worldIdAction: `study_enrollment_${study.id}`,
    },
  });
}
