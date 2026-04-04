import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { generateReverseItems } from "@/lib/quality";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { studyId } = await params;

  // Verify the researcher owns this study
  const researcherId = (session.user as { id: string }).id;
  const studyResult = await pool.query(
    'SELECT "id" FROM "Study" WHERE "id" = $1 AND "researcherId" = $2',
    [studyId, researcherId]
  );
  if (studyResult.rows.length === 0) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const count = Math.min(Math.max(body.count ?? 2, 1), 5);

  const items = await generateReverseItems(studyId, count);

  return NextResponse.json({
    studyId,
    generatedItems: items,
    usage: "Review these suggestions, then POST to /api/studies/{studyId} to add them as questions.",
  });
}
