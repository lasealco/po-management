/** Allowed `TariffContractVersion.sourceType` values (keep in sync with Prisma / API). */
export const TARIFF_CONTRACT_VERSION_SOURCE_TYPES = [
  "MANUAL",
  "EXCEL",
  "PDF",
  "API",
  "EDI",
  "EMAIL",
  "SYSTEM",
] as const;

export const TARIFF_CONTRACT_VERSION_SOURCE_TYPE_SET = new Set<string>(TARIFF_CONTRACT_VERSION_SOURCE_TYPES);
