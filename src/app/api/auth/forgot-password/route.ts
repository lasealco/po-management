import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  appOriginFromRequest,
  newPasswordResetSecret,
  PASSWORD_RESET_EXPIRY_MS,
  sendPasswordResetResendEmail,
} from "@/lib/auth/password-reset";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";

const GENERIC_OK = {
  ok: true as const,
  message: "If an account exists for that email, you will receive a link to reset your password.",
};

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
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";
  if (!emailRaw || !emailRaw.includes("@")) {
    return toApiErrorResponse({
      error: "A valid email is required.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      isActive: true,
      email: { equals: emailRaw, mode: Prisma.QueryMode.insensitive },
    },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    return NextResponse.json(GENERIC_OK);
  }

  const { raw, tokenHash } = newPasswordResetSecret();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    }),
  ]);

  const origin = appOriginFromRequest(request);
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(raw)}`;
  const text = [
    "You asked to reset your password for this app.",
    "",
    `Open this link (valid for about 1 hour): ${resetUrl}`,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const send = await sendPasswordResetResendEmail({
    to: user.email,
    subject: "Reset your password",
    text,
  });
  if (!send.ok) {
    console.error("[forgot-password] Resend failed:", send.reason);
  }

  return NextResponse.json(GENERIC_OK);
}
