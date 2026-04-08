import { NextResponse } from "next/server";
import { PrismaClient } from "../../../../generated/prisma";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "connected" });
  } catch {
    return NextResponse.json({ ok: false, db: "disconnected" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
