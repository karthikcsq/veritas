import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const result = await pool.query(
    `SELECT
      s."id",
      s."title",
      s."description",
      s."compensationUsd",
      s."targetCount",
      COUNT(q."id") AS "questionCount"
    FROM "Study" s
    LEFT JOIN "Question" q ON q."studyId" = s."id"
    WHERE s."status" = 'ACTIVE'
    GROUP BY s."id", s."title", s."description", s."compensationUsd", s."targetCount", s."createdAt"
    ORDER BY s."createdAt" DESC`
  );

  return NextResponse.json({
    studies: result.rows.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      compensationUsd: parseFloat(s.compensationUsd),
      targetCount: s.targetCount,
      questionCount: parseInt(s.questionCount, 10),
    })),
  });
}
