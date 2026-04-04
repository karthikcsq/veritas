import { NextResponse } from "next/server";
import { pool, generateId } from "@/lib/db";
import type { EnrollRequest } from "@/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const { studyId } = await params;
  const body: EnrollRequest = await req.json();
  const { idkitResponse } = body;
  const expectedAction = `study_enrollment_${studyId}`;
  const payloadAction =
    typeof idkitResponse === "object" &&
    idkitResponse !== null &&
    "action" in idkitResponse &&
    typeof (idkitResponse as { action?: unknown }).action === "string"
      ? (idkitResponse as { action: string }).action
      : null;

  if (payloadAction !== expectedAction) {
    return NextResponse.json(
      { error: "Invalid IDKit payload: unexpected action" },
      { status: 400 }
    );
  }

  // 1. Verify proof + store/dedup nullifier via verify-proof endpoint
  const rpId = process.env.WORLD_RP_ID;
  if (!rpId) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing WORLD_RP_ID" },
      { status: 500 }
    );
  }

  const verifyResponse = await fetch(
    `${process.env.NEXTAUTH_URL}/api/verify-proof`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rp_id: rpId,
        idkitResponse,
      }),
    },
  );

  if (!verifyResponse.ok) {
    const verifyError = await verifyResponse.json().catch(() => ({}));
    const status = verifyResponse.status;

    // 409 = duplicate nullifier = already enrolled
    if (status === 409) {
      return NextResponse.json(
        { error: "You have already enrolled in this study." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: "World ID verification failed",
        details: (verifyError as { error?: string }).error ?? "Unknown error",
      },
      { status: 400 }
    );
  }

  const { nullifier } = (await verifyResponse.json()) as {
    nullifier: string;
  };

  // 2. Create participant if first time, then create enrollment
  const participantId = generateId();
  const participantResult = await pool.query(
    'INSERT INTO "Participant" ("id", "nullifierHash", "createdAt") VALUES ($1, $2, NOW()) ON CONFLICT ("nullifierHash") DO UPDATE SET "nullifierHash" = EXCLUDED."nullifierHash" RETURNING "id"',
    [participantId, nullifier]
  );
  const participant = participantResult.rows[0];

  const enrollmentId = generateId();
  const enrollmentResult = await pool.query(
    'INSERT INTO "Enrollment" ("id", "participantId", "studyId", "worldIdProof", "status", "enrolledAt") VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING "id"',
    [enrollmentId, participant.id, studyId, JSON.stringify(idkitResponse), "VERIFIED"]
  );
  const enrollment = enrollmentResult.rows[0];

  return NextResponse.json(
    {
      enrollmentId: enrollment.id,
      message: "Enrollment verified. You may begin the study.",
    },
    { status: 201 }
  );
}
