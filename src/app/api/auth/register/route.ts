import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { RegisterRequest } from "@/types";

export async function POST(req: Request) {
  const body: RegisterRequest = await req.json();

  const existing = await prisma.researcher.findUnique({
    where: { email: body.email },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Email already registered" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(body.password, 12);

  const researcher = await prisma.researcher.create({
    data: {
      email: body.email,
      name: body.name,
      passwordHash,
    },
  });

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
