import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { studyId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const study = await prisma.study.findUnique({
    where: { id: params.studyId },
    include: {
      questions: { orderBy: { order: "asc" } },
      enrollments: {
        include: {
          responses: {
            include: { qualityScore: true },
          },
        },
      },
    },
  });

  if (!study) {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  return NextResponse.json({
    study: {
      id: study.id,
      title: study.title,
      description: study.description,
      status: study.status,
      targetCount: study.targetCount,
      compensationUsd: study.compensationUsd,
      questions: study.questions,
      enrollments: study.enrollments.map((e) => {
        const scores = e.responses
          .map((r) => r.qualityScore?.overallScore)
          .filter((s): s is number => s != null);
        const avg =
          scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : null;
        return {
          id: e.id,
          status: e.status,
          enrolledAt: e.enrolledAt.toISOString(),
          averageQualityScore: avg,
          flagged: e.status === "FLAGGED",
        };
      }),
    },
  });
}
