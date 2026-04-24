import type { OrgUnitKind } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { isPresetGroupCode, isPresetRegionCode } from "@/lib/org-code-presets";
import { normalizeOrgUnitCode } from "@/lib/org-unit";

/**
 * Enforces structured codes: REGION & GROUP = presets; COUNTRY = active ReferenceCountry;
 * other kinds use the normal org-unit code normalizer only.
 */
export async function validateOrgUnitCodeForKind(
  prisma: PrismaClient,
  kind: OrgUnitKind,
  code: string,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const n = normalizeOrgUnitCode(code);
  if (!n.ok) return n;
  const c = n.code;
  if (kind === "REGION") {
    if (!isPresetRegionCode(c)) {
      return { ok: false, error: "For REGION, pick a standard region code from the list." };
    }
    return { ok: true, code: c };
  }
  if (kind === "GROUP") {
    if (!isPresetGroupCode(c)) {
      return { ok: false, error: "For GROUP, pick a standard group / global code from the list." };
    }
    return { ok: true, code: c };
  }
  if (kind === "COUNTRY") {
    const found = await prisma.referenceCountry.findFirst({
      where: { isActive: true, isoAlpha2: c },
      select: { id: true },
    });
    if (!found) {
      return { ok: false, error: "For COUNTRY, pick an ISO-3166-1 alpha-2 code from the list." };
    }
    return { ok: true, code: c };
  }
  return { ok: true, code: c };
}
