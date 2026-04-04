import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CreateStudyRequest } from "@/types";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: CreateStudyRequest = await req.json();
  const researcherId = (session.user as any).id;

  const study = await prisma.study.create({
    data: {
      researcherId,
      title: body.title,
      description: body.description,
      targetCount: body.targetCount,
      compensationUsd: body.compensationUsd,
      questions: {
        create: body.questions.map((q) => ({
          order: q.order,
          type: q.type,
          prompt: q.prompt,
          options: q.options ?? undefined,
        })),
      },
    },
  });

  return NextResponse.json(
    {
      study: {
        id: study.id,
        title: study.title,
        status: study.status,
        worldIdAction: `study_enrollment_${study.id}`,
      },
    },
    { status: 201 }
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const researcherId = (session.user as any).id;

  const studies = await prisma.study.findMany({
    where: { researcherId },
    include: {
      _count: {
        select: { enrollments: true },
      },
      enrollments: {
        select: { status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    studies: studies.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      targetCount: s.targetCount,
      enrollmentCount: s._count.enrollments,
      completedCount: s.enrollments.filter((e) => e.status === "COMPLETED")
        .length,
      flaggedCount: s.enrollments.filter((e) => e.status === "FLAGGED").length,
    })),
  });
}
