import type { OrgUnitKind } from "@prisma/client";

/**
 * In-tenant statutory profile lives in `CompanyLegalEntity` (Prisma) / `company_legal_entities` (DB).
 * Distinct from `TariffLegalEntity` (table `legal_entities`, tariff pricing).
 */
export function isOrgUnitKindLegalEntity(kind: OrgUnitKind): boolean {
  return kind === "LEGAL_ENTITY";
}
