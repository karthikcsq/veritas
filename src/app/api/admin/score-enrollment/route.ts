import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { triggerScoringPipeline } from "@/lib/scorer";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { enrollmentId } = (await req.json()) as { enrollmentId: string };
  if (!enrollmentId) {
    return NextResponse.json({ error: "enrollmentId required" }, { status: 400 });
  }

  const responseResult = await pool.query(
    'SELECT r."id" FROM "Response" r WHERE r."enrollmentId" = $1',
    [enrollmentId]
  );

  if (responseResult.rows.length === 0) {
    return NextResponse.json({ error: "No responses found" }, { status: 404 });
  }

  const responseIds = responseResult.rows.map((r) => r.id);

  try {
    await triggerScoringPipeline(enrollmentId, responseIds);
    return NextResponse.json({ success: true, scored: responseIds.length });
  } catch (e) {
    console.error("Scoring failed for", enrollmentId, e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
