import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { triggerScoringPipeline } from "@/lib/scorer";
import type { SubmitResponsesRequest } from "@/types";

// POST — participant submits responses (no auth, identified by enrollmentId)
export async function POST(
  req: Request,
  { params }: { params: { enrollmentId: string } }
) {
  const body: SubmitResponsesRequest = await req.json();

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: params.enrollmentId },
  });
  if (!enrollment) {
    return NextResponse.json(
      { error: "Enrollment not found" },
      { status: 404 }
    );
  }

  // Save all responses in a transaction
  const savedResponses = await prisma.$transaction(
    body.responses.map((r) =>
      prisma.response.create({
        data: {
          enrollmentId: params.enrollmentId,
          questionId: r.questionId,
          value: r.value,
          timeSpentMs: r.timeSpentMs,
        },
      })
    )
  );

  // Update enrollment status
  await prisma.enrollment.update({
    where: { id: params.enrollmentId },
    data: { status: "IN_PROGRESS" },
  });

  // Fire and forget — scoring runs in background
  triggerScoringPipeline(
    params.enrollmentId,
    savedResponses.map((r) => r.id)
  ).catch(console.error);

  return NextResponse.json(
    {
      message: "Responses submitted. Quality scoring in progress.",
      enrollmentId: params.enrollmentId,
    },
    { status: 201 }
  );
}

// GET — researcher views responses with quality scores
export async function GET(
  _req: Request,
  { params }: { params: { enrollmentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const responses = await prisma.response.findMany({
    where: { enrollmentId: params.enrollmentId },
    include: {
      question: true,
      qualityScore: true,
    },
    orderBy: { question: { order: "asc" } },
  });

  return NextResponse.json({
    responses: responses.map((r) => ({
      questionId: r.questionId,
      questionPrompt: r.question.prompt,
      value: r.value,
      timeSpentMs: r.timeSpentMs,
      qualityScore: r.qualityScore
        ? {
            overallScore: r.qualityScore.overallScore,
            coherenceScore: r.qualityScore.coherenceScore,
            effortScore: r.qualityScore.effortScore,
            consistencyScore: r.qualityScore.consistencyScore,
            flagged: r.qualityScore.flagged,
            flagReason: r.qualityScore.flagReason,
          }
        : null,
    })),
  });
}
