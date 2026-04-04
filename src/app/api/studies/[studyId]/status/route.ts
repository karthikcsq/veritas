import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { detectAndStoreReversePairs } from "@/lib/quality";

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

  // When publishing (ACTIVE), auto-detect reverse-scored pairs
  let reversePairs: { construct: string; relationship: string }[] = [];
  if (status === "ACTIVE") {
    try {
      const pairs = await detectAndStoreReversePairs(studyId);
      reversePairs = pairs.map((p) => ({
        construct: p.construct,
        relationship: p.relationship,
      }));
    } catch (err) {
      console.error("Reverse pair detection failed (non-fatal):", err);
    }
  }

  return NextResponse.json({
    study: { id: study.id, status: study.status },
    reversePairsDetected: reversePairs.length,
    reversePairs,
  });
}
