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

  const enrollments = await prisma.enrollment.findMany({
    where: { studyId: params.studyId },
    include: {
      responses: {
        include: { qualityScore: true },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const completed = enrollments.filter((e) => e.status === "COMPLETED").length;
  const inProgress = enrollments.filter(
    (e) => e.status === "IN_PROGRESS" || e.status === "VERIFIED"
  ).length;
  const flagged = enrollments.filter((e) => e.status === "FLAGGED").length;

  // Compute average quality score across all scored responses
  const allScores = enrollments.flatMap((e) =>
    e.responses
      .map((r) => r.qualityScore?.overallScore)
      .filter((s): s is number => s != null)
  );
  const averageQualityScore =
    allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0;

  const high = allScores.filter((s) => s >= 0.7).length;
  const medium = allScores.filter((s) => s >= 0.45 && s < 0.7).length;
  const low = allScores.filter((s) => s < 0.45).length;

  return NextResponse.json({
    stats: {
      totalEnrollments: enrollments.length,
      completed,
      inProgress,
      flagged,
      averageQualityScore: Math.round(averageQualityScore * 100) / 100,
      qualityDistribution: { high, medium, low },
    },
    recentEnrollments: enrollments.slice(0, 10).map((e) => ({
      id: e.id,
      status: e.status,
      enrolledAt: e.enrolledAt.toISOString(),
    })),
  });
}
