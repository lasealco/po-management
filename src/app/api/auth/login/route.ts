import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { PO_AUTH_USER_COOKIE, PO_DEMO_USER_COOKIE } from "@/lib/demo-actor";
import { resolvePasswordLoginEmail } from "@/lib/auth-login-identity";
import { getDemoTenant } from "@/lib/demo-tenant";
import { httpSessionBase } from "@/lib/http-session-cookie";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const emailRaw =
    body && typeof body === "object" && typeof (body as { email?: unknown }).email === "string"
      ? (body as { email: string }).email.trim()
      : "";
  const email = resolvePasswordLoginEmail(emailRaw, tenant.slug);
  const password =
    body && typeof body === "object" && typeof (body as { password?: unknown }).password === "string"
      ? (body as { password: string }).password
      : "";
  if (!email || !password) {
    return toApiErrorResponse({
      error: "email (or username) and password are required.",
      code: "BAD_INPUT",
      status: 400,
    });
  }
  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      isActive: true,
      email: { equals: email, mode: Prisma.QueryMode.insensitive },
    },
    select: { email: true, passwordHash: true },
  });
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return toApiErrorResponse({ error: "Invalid credentials.", code: "UNAUTHORIZED", status: 401 });
  }

  const base = httpSessionBase();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PO_AUTH_USER_COOKIE, user.email, {
    ...base,
    maxAge: COOKIE_MAX_AGE,
  });
  res.cookies.set(PO_DEMO_USER_COOKIE, "", { ...base, maxAge: 0 });
  return res;
}
