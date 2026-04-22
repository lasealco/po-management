import { prisma } from "@/lib/prisma";

/** Max distinct codes accepted per catalog-check request (after normalize). */
export const TARIFF_GEO_CATALOG_CHECK_MAX_CODES = 500;

/**
 * Dedupe, trim, uppercase UN/LOC-style inputs for catalog checks (pure; safe to unit test).
 */
export function normalizeUnlocCodesForCatalogCheck(codes: string[]): string[] {
  return [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
}

/**
 * Cross-check UN/LOC-style codes on tariff geography members against the tenant **LocationCode** catalog.
 * Does not block saves — used for admin warnings and future FK-style validation.
 */
export async function classifyTariffUnlocsAgainstLocationCatalog(params: {
  tenantId: string;
  codes: string[];
}): Promise<{ known: string[]; unknown: string[] }> {
  const normalized = normalizeUnlocCodesForCatalogCheck(params.codes);
  if (normalized.length === 0) return { known: [], unknown: [] };

  const hits = await prisma.locationCode.findMany({
    where: { tenantId: params.tenantId, isActive: true, code: { in: normalized } },
    select: { code: true },
  });
  const hitSet = new Set(hits.map((h) => h.code.toUpperCase()));
  const known: string[] = [];
  const unknown: string[] = [];
  for (const c of normalized) {
    if (hitSet.has(c)) known.push(c);
    else unknown.push(c);
  }
  return { known, unknown };
}
