import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getDemoActorEmail, PO_DEMO_USER_COOKIE } from "@/lib/demo-actor";
import { getDemoTenant } from "@/lib/demo-tenant";
import { httpSessionBase } from "@/lib/http-session-cookie";
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
    where: {
      tenantId: tenant.id,
      isActive: true,
      email: { equals: emailRaw, mode: Prisma.QueryMode.insensitive },
    },
    select: { email: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found or inactive for this tenant." },
      { status: 400 },
    );
  }

  const base = httpSessionBase();
  const res = NextResponse.json({ ok: true, email: user.email });
  res.cookies.set(PO_DEMO_USER_COOKIE, user.email, {
    ...base,
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const base = httpSessionBase();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PO_DEMO_USER_COOKIE, "", { ...base, maxAge: 0 });
  return res;
}
