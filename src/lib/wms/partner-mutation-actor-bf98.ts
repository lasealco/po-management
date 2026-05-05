/**
 * BF-98 — partner mutations attribute DB writes to a deterministic tenant user surrogate (machine callers lack sessions).
 * Uses the tenant's earliest-created active user; operators should treat inboundASN advises created via partner keys accordingly.
 */

import type { PrismaClient } from "@prisma/client";

export async function resolvePartnerMutationActorUserIdBf98(
  prisma: PrismaClient,
  tenantId: string,
): Promise<string | null> {
  const u = await prisma.user.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return u?.id ?? null;
}
