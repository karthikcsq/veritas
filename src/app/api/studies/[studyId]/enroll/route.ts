import { NextResponse } from "next/server";
import { verifyWorldIdProof } from "@/lib/worldid";
import { prisma } from "@/lib/prisma";
import type { EnrollRequest } from "@/types";

export async function POST(
  req: Request,
  { params }: { params: { studyId: string } }
) {
  const body: EnrollRequest = await req.json();
  const { proof } = body;

  // 1. Verify the ZK proof with World ID cloud
  const verifyResult = await verifyWorldIdProof(proof as any, params.studyId);
  if (!verifyResult.success) {
    return NextResponse.json(
      { error: "World ID verification failed" },
      { status: 400 }
    );
  }

  const nullifierHash = proof.nullifier_hash;

  // 2. Check if this nullifier has already enrolled in this study
  const existingParticipant = await prisma.participant.findUnique({
    where: { nullifierHash },
  });

  if (existingParticipant) {
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        participantId_studyId: {
          participantId: existingParticipant.id,
          studyId: params.studyId,
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
      studyId: params.studyId,
      worldIdProof: proof as object,
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
