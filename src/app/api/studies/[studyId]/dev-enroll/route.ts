import { NextResponse } from "next/server";
import { pool, generateId } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  const { studyId } = await params;

  const studyResult = await pool.query(
    'SELECT "id" FROM "Study" WHERE "id" = $1',
    [studyId]
  );
  if (studyResult.rows.length === 0) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  const participantId = generateId();
  await pool.query(
    'INSERT INTO "Participant" ("id", "nullifierHash", "createdAt") VALUES ($1, $2, NOW())',
    [participantId, `dev_${generateId()}`]
  );

  const enrollmentId = generateId();
  await pool.query(
    'INSERT INTO "Enrollment" ("id", "participantId", "studyId", "worldIdProof", "status", "enrolledAt") VALUES ($1, $2, $3, $4, $5, NOW())',
    [enrollmentId, participantId, studyId, JSON.stringify({ dev: true }), "VERIFIED"]
  );

  return NextResponse.json({ enrollmentId }, { status: 201 });
}
