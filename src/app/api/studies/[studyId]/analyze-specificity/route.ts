import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { analyzeSpecificity } from "@/lib/quality";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { studyId } = await params;

  const [studyResult, questionsResult] = await Promise.all([
    pool.query('SELECT "description" FROM "Study" WHERE "id" = $1', [studyId]),
    pool.query('SELECT "prompt", "type", "options", "config" FROM "Question" WHERE "studyId" = $1 ORDER BY "order"', [studyId]),
  ]);

  const studyDescription = studyResult.rows[0]?.description ?? "";
  const result = await analyzeSpecificity(questionsResult.rows, studyDescription);
  return NextResponse.json(result);
}
