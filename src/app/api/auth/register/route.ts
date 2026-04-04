import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool, generateId } from "@/lib/db";
import type { RegisterRequest } from "@/types";

export async function POST(req: Request) {
  const body: RegisterRequest = await req.json();

  const existingResult = await pool.query(
    'SELECT "id" FROM "Researcher" WHERE "email" = $1',
    [body.email]
  );
  if (existingResult.rows.length > 0) {
    return NextResponse.json(
      { error: "Email already registered" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const id = generateId();

  const result = await pool.query(
    'INSERT INTO "Researcher" ("id", "email", "name", "passwordHash", "createdAt") VALUES ($1, $2, $3, $4, NOW()) RETURNING "id", "email", "name"',
    [id, body.email, body.name, passwordHash]
  );
  const researcher = result.rows[0];

  return NextResponse.json(
    {
      researcher: {
        id: researcher.id,
        email: researcher.email,
        name: researcher.name,
      },
    },
    { status: 201 }
  );
}
