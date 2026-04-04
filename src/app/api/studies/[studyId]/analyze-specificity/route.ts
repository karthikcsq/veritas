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

  const questions = await pool.query(
    'SELECT "prompt", "type" FROM "Question" WHERE "studyId" = $1 ORDER BY "order"',
    [studyId]
  );

  const result = await analyzeSpecificity(questions.rows);
  return NextResponse.json(result);
}
