import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { EnrollRequest } from "@/types";
import {
  extractNullifierFromIdKitPayload,
  verifyIdKitPayload,
} from "@/lib/worldid";

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

  // 1. Verify the IDKit response with World ID Developer Portal.
  const verifyResponse = await verifyIdKitPayload(idkitResponse);
  if (!verifyResponse.ok) {
    const verifyError = await verifyResponse.text();
    return NextResponse.json(
      {
        error: "World ID verification failed",
        details: verifyError,
      },
      { status: 400 }
    );
  }

  const nullifierHash = extractNullifierFromIdKitPayload(idkitResponse);
  if (!nullifierHash) {
    return NextResponse.json(
      { error: "Invalid IDKit payload: missing nullifier" },
      { status: 400 }
    );
  }

  // 2. Check if this nullifier has already enrolled in this study
  const existingParticipant = await prisma.participant.findUnique({
    where: { nullifierHash },
  });

  if (existingParticipant) {
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        participantId_studyId: {
          participantId: existingParticipant.id,
          studyId: studyId,
        },
      },
    });
    if (existingEnrollment) {
      return NextResponse.json(
        { error: "You have already enrolled in this study." },
        { status: 409 }
      );
    }
  }

  // 3. Create participant if first time, then create enrollment
  const participant = await prisma.participant.upsert({
    where: { nullifierHash },
    create: { nullifierHash },
    update: {},
  });

  const enrollment = await prisma.enrollment.create({
    data: {
      participantId: participant.id,
      studyId: studyId,
      worldIdProof: idkitResponse as object,
      status: "VERIFIED",
    },
  });

  return NextResponse.json(
    {
      enrollmentId: enrollment.id,
      message: "Enrollment verified. You may begin the study.",
    },
    { status: 201 }
  );
}
