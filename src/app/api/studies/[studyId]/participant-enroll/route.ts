import { NextResponse } from "next/server";
import { pool, generateId } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const { studyId } = await params;
  const { participantId } = (await req.json()) as { participantId?: string };

  if (!participantId) {
    return NextResponse.json({ error: "participantId required" }, { status: 400 });
  }

  // Verify participant exists
  const participantResult = await pool.query(
    'SELECT "id" FROM "Participant" WHERE "id" = $1',
    [participantId]
  );
  if (participantResult.rows.length === 0) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  // Verify study is active
  const studyResult = await pool.query(
    'SELECT "id" FROM "Study" WHERE "id" = $1 AND "status" = $2',
    [studyId, "ACTIVE"]
  );
  if (studyResult.rows.length === 0) {
    return NextResponse.json({ error: "Study not found or not active" }, { status: 404 });
  }

  // Return existing enrollment if already enrolled
  const existingResult = await pool.query(
    'SELECT "id" FROM "Enrollment" WHERE "participantId" = $1 AND "studyId" = $2',
    [participantId, studyId]
  );
  if (existingResult.rows.length > 0) {
    return NextResponse.json({ enrollmentId: existingResult.rows[0].id });
  }

  // Create enrollment
  const enrollmentId = generateId();
  await pool.query(
    'INSERT INTO "Enrollment" ("id", "participantId", "studyId", "worldIdProof", "status", "enrolledAt") VALUES ($1, $2, $3, $4, $5, NOW())',
    [enrollmentId, participantId, studyId, JSON.stringify({ type: "participant_login", participantId }), "VERIFIED"]
  );

  return NextResponse.json({ enrollmentId }, { status: 201 });
}
