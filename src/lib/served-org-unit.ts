import { prisma } from "@/lib/prisma";

/**
 * Validates an optional org unit id for the tenant (e.g. PO/SO "order for" field).
 * Empty string and null both mean clear / none.
 */
export async function resolveServedOrgUnitIdForTenant(
  tenantId: string,
  raw: unknown,
): Promise<{ ok: true; value: string | null } | { ok: false; error: string }> {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "servedOrgUnitId must be a string id, null, or omitted." };
  }
  const id = raw.trim();
  if (!id) {
    return { ok: true, value: null };
  }
  const u = await prisma.orgUnit.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!u) {
    return {
      ok: false,
      error: "servedOrgUnitId is not a valid org unit in this company.",
    };
  }
  return { ok: true, value: u.id };
}
