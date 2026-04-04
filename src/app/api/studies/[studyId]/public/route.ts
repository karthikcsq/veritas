import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { studyId: string } }
) {
  const study = await prisma.study.findUnique({
    where: { id: params.studyId },
    include: { _count: { select: { questions: true } } },
  });

  if (!study || study.status !== "ACTIVE") {
    return NextResponse.json({ error: "Study not found" }, { status: 404 });
  }

  return NextResponse.json({
    study: {
      id: study.id,
      title: study.title,
      description: study.description,
      compensationUsd: study.compensationUsd,
      questionCount: study._count.questions,
      worldIdAction: `study_enrollment_${study.id}`,
    },
  });
}
