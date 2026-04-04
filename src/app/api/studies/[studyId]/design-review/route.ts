import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { analyzeSurveyDesign } from "@/lib/quality";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { studyId } = await params;

  const researcherId = (session.user as { id: string }).id;
  const studyResult = await pool.query(
    'SELECT "id", "title" FROM "Study" WHERE "id" = $1 AND "researcherId" = $2',
    [studyId, researcherId]
  );
  if (studyResult.rows.length === 0) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  const questionsResult = await pool.query(
    `SELECT "id", "order", "type", "prompt", "options", "config"
     FROM "Question"
     WHERE "studyId" = $1
     ORDER BY "order"`,
    [studyId]
  );

  const questions = questionsResult.rows.map((q) => ({
    id: q.id,
    order: q.order,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    config: q.config,
  }));

  const recommendations = analyzeSurveyDesign(questions);

  return NextResponse.json({
    studyId,
    studyTitle: studyResult.rows[0].title,
    questionCount: questions.length,
    recommendations,
  });
}
