import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ studyId: string }> }
) {
  const { studyId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { status } = await req.json();

  if (!["DRAFT", "ACTIVE", "CLOSED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const result = await pool.query(
    'UPDATE "Study" SET "status" = $1, "updatedAt" = NOW() WHERE "id" = $2 RETURNING "id", "status"',
    [status, studyId]
  );
  const study = result.rows[0];

  return NextResponse.json({
    study: { id: study.id, status: study.status },
  });
}
