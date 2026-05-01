import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";

export function customerPortalSsoCanonicalPayload(sub: string, email: string, ts: number): string {
  return `${sub.trim()}\n${email.trim().toLowerCase()}\n${String(ts)}`;
}

export function signCustomerPortalSsoPayload(secret: string, sub: string, email: string, ts: number): string {
  return crypto
    .createHmac("sha256", secret)
    .update(customerPortalSsoCanonicalPayload(sub, email, ts))
    .digest("hex");
}

/** HMAC assertion from an external IdP broker (BF-30); `ts` is Unix epoch milliseconds. */
export function verifyCustomerPortalSsoPayload(
  secret: string,
  sub: string,
  email: string,
  ts: number,
  sig: string,
  skewMs = 300_000,
): boolean {
  if (!secret || !sub.trim() || !email.trim() || !Number.isFinite(ts) || !sig.trim()) return false;
  if (Math.abs(Date.now() - ts) > skewMs) return false;
  const expected = signCustomerPortalSsoPayload(secret, sub, email, ts);
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(sig.trim(), "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Resolve tenant user for portal SSO. Requires `customerCrmAccountId` (portal scope).
 * Prefer `customerPortalExternalSubject` match when `externalSubject` is provided.
 */
export async function resolveUserForCustomerPortalSso(
  tenantId: string,
  opts: { externalSubject?: string | null; email?: string | null },
): Promise<{ id: string; email: string; customerCrmAccountId: string } | null> {
  const sub = opts.externalSubject?.trim() || "";
  const email = opts.email?.trim().toLowerCase() || "";

  if (sub) {
    const bySub = await prisma.user.findFirst({
      where: { tenantId, customerPortalExternalSubject: sub, isActive: true },
      select: { id: true, email: true, customerCrmAccountId: true },
    });
    if (bySub?.customerCrmAccountId) {
      return {
        id: bySub.id,
        email: bySub.email,
        customerCrmAccountId: bySub.customerCrmAccountId,
      };
    }
  }

  if (email) {
    const byEmail = await prisma.user.findFirst({
      where: { tenantId, email: { equals: email, mode: "insensitive" }, isActive: true },
      select: { id: true, email: true, customerCrmAccountId: true },
    });
    if (byEmail?.customerCrmAccountId) {
      return {
        id: byEmail.id,
        email: byEmail.email,
        customerCrmAccountId: byEmail.customerCrmAccountId,
      };
    }
  }

  return null;
}
