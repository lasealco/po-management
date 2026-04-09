import { NextResponse } from "next/server";

import { getDemoActorEmail, PO_DEMO_USER_COOKIE } from "@/lib/demo-actor";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export async function GET() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id },
    orderBy: { email: "asc" },
    select: { email: true, name: true, isActive: true },
  });

  const current = await getDemoActorEmail();

  return NextResponse.json({ users, current });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const emailRaw =
    body && typeof body === "object" && typeof (body as { email?: unknown }).email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";

  if (!emailRaw) {
    return NextResponse.json({ error: "email is required." }, { status: 400 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: emailRaw, isActive: true },
    select: { email: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found or inactive for this tenant." },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ ok: true, email: user.email });
  res.cookies.set(PO_DEMO_USER_COOKIE, user.email, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PO_DEMO_USER_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
  });
  return res;
}
