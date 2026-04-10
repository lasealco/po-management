import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PO_AUTH_USER_COOKIE } from "@/lib/demo-actor";
import { getDemoTenant } from "@/lib/demo-tenant";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function sessionCookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    httpOnly: true,
    secure,
  };
}

export async function POST(request: Request) {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const email =
    body && typeof body === "object" && typeof (body as { email?: unknown }).email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";
  const password =
    body && typeof body === "object" && typeof (body as { password?: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";
  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required." }, { status: 400 });
  }
  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email, isActive: true },
    select: { email: true, passwordHash: true },
  });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }
  const jar = await cookies();
  jar.set(PO_AUTH_USER_COOKIE, user.email, sessionCookieOptions());
  return NextResponse.json({ ok: true });
}
