import { NextResponse } from "next/server";
import { pool, generateId } from "@/lib/db";

export async function POST(req: Request) {
  const { nullifier } = (await req.json()) as { nullifier?: string };

  if (!nullifier) {
    return NextResponse.json({ error: "nullifier required" }, { status: 400 });
  }

  const participantId = generateId();
  const result = await pool.query(
    'INSERT INTO "Participant" ("id", "nullifierHash", "createdAt") VALUES ($1, $2, NOW()) ON CONFLICT ("nullifierHash") DO UPDATE SET "nullifierHash" = EXCLUDED."nullifierHash" RETURNING "id"',
    [participantId, nullifier]
  );

  return NextResponse.json({ participantId: result.rows[0].id });
}
