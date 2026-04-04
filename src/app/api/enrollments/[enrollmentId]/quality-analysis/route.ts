import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { analyzeStructuredQuality } from "@/lib/quality";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { enrollmentId } = await params;

  // Verify the researcher owns the study this enrollment belongs to
  const researcherId = (session.user as { id: string }).id;
  const enrollmentResult = await pool.query(
    `SELECT e."id"
     FROM "Enrollment" e
     JOIN "Study" s ON s."id" = e."studyId"
     WHERE e."id" = $1 AND s."researcherId" = $2`,
    [enrollmentId, researcherId]
  );
  if (enrollmentResult.rows.length === 0) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    );
  }

  const result = await analyzeStructuredQuality(enrollmentId);

  return NextResponse.json(result);
}
