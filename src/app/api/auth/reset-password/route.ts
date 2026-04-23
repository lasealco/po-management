import { NextResponse } from "next/server";

import { hashPasswordResetToken } from "@/lib/auth/password-reset";
import { getDemoTenant } from "@/lib/demo-tenant";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";

const MIN_LEN = 8;

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
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const token = typeof o.token === "string" ? o.token.trim() : "";
  const password = typeof o.password === "string" ? o.password : "";
  if (!token || !password) {
    return toApiErrorResponse({
      error: "token and password are required.",
      code: "BAD_INPUT",
      status: 400,
    });
  }
  if (password.length < MIN_LEN) {
    return toApiErrorResponse({
      error: `password must be at least ${MIN_LEN} characters.`,
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const tokenHash = hashPasswordResetToken(token);
  const now = new Date();

  const row = await prisma.passwordResetToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    include: { user: { select: { id: true, tenantId: true, isActive: true } } },
  });
  if (!row || row.user.tenantId !== tenant.id || !row.user.isActive) {
    return toApiErrorResponse({
      error: "This reset link is invalid or has expired. Request a new one.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const newHash = hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash: newHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: now },
    }),
  ]);

  return NextResponse.json({ ok: true, message: "Your password has been updated. You can sign in now." });
}
