import { serializeCompanyLegalEntity, type SerializedCompanyLegalEntity } from "@/lib/company-legal-entity";
import { prisma } from "@/lib/prisma";

/**
 * Resolves the tenant `CompanyLegalEntity` (if any) for the order-for (served) org unit
 * to show a statutory “selling / contracting” snapshot on the sales order.
 */
export async function loadSerializedCompanyLegalForServedOrg(
  tenantId: string,
  servedOrgUnitId: string | null,
): Promise<SerializedCompanyLegalEntity | null> {
  if (!servedOrgUnitId) return null;
  const row = await prisma.companyLegalEntity.findFirst({
    where: { tenantId, orgUnitId: servedOrgUnitId },
    include: { orgUnit: { select: { id: true, name: true, code: true, kind: true } } },
  });
  if (!row) return null;
  return serializeCompanyLegalEntity(row);
}

/**
 * For list UIs: registered legal name keyed by `orgUnitId` (only org units with a profile).
 */
export async function mapOrgUnitIdsToCompanyLegalNames(
  tenantId: string,
  orgUnitIds: readonly string[],
): Promise<Map<string, string>> {
  if (orgUnitIds.length === 0) return new Map();
  const uniq = [...new Set(orgUnitIds.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const rows = await prisma.companyLegalEntity.findMany({
    where: { tenantId, orgUnitId: { in: uniq } },
    select: { orgUnitId: true, registeredLegalName: true },
  });
  return new Map(rows.map((r) => [r.orgUnitId, r.registeredLegalName] as const));
}
