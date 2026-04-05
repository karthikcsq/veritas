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

  const questionsResult = await pool.query(
    'SELECT "id", "order", "type", "prompt", "options", "required", "config", "dependsOn" FROM "Question" WHERE "studyId" = $1 ORDER BY "order" ASC',
    [studyId]
  );

  return NextResponse.json({
    study: {
      id: study.id,
      title: study.title,
      description: study.description,
      compensationUsd: study.compensationUsd,
      questionCount: questionsResult.rows.length,
      worldIdAction: `study_enrollment_${study.id}`,
      questions: questionsResult.rows.map((q) => ({
        id: q.id,
        order: q.order,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        required: q.required,
        config: q.config,
        dependsOn: q.dependsOn,
      })),
    },
  });
}
