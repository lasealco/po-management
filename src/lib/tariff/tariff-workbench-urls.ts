/** App-router prefix for the Tariffs product area. */
export const TARIFFS_MODULE_BASE_PATH = "/tariffs" as const;

export const TARIFF_RATE_LOOKUP_PATH = `${TARIFFS_MODULE_BASE_PATH}/rate-lookup` as const;
export const TARIFF_RATING_PATH = `${TARIFFS_MODULE_BASE_PATH}/rating` as const;

/** Contract directory list (default tariffs landing). */
export const TARIFF_CONTRACTS_DIRECTORY_PATH = `${TARIFFS_MODULE_BASE_PATH}/contracts` as const;

/** Create-contract wizard (under directory). */
export const TARIFF_NEW_CONTRACT_PATH = `${TARIFF_CONTRACTS_DIRECTORY_PATH}/new` as const;

export const TARIFF_PROVIDERS_PATH = `${TARIFFS_MODULE_BASE_PATH}/providers` as const;
export const TARIFF_LEGAL_ENTITIES_PATH = `${TARIFFS_MODULE_BASE_PATH}/legal-entities` as const;

export const TARIFF_IMPORT_PATH = `${TARIFFS_MODULE_BASE_PATH}/import` as const;
export const TARIFF_IMPORT_NEW_PATH = `${TARIFF_IMPORT_PATH}/new` as const;

export const TARIFF_GEOGRAPHY_PATH = `${TARIFFS_MODULE_BASE_PATH}/geography` as const;
export const TARIFF_GEOGRAPHY_NEW_PATH = `${TARIFF_GEOGRAPHY_PATH}/new` as const;

export const TARIFF_CHARGE_CODES_PATH = `${TARIFFS_MODULE_BASE_PATH}/charge-codes` as const;

/**
 * Exact Tariffs app-router paths allowed for help `open_path` (server allowlist).
 * Keep in sync with the tariffs playbook and command palette entry routes.
 */
export const TARIFF_HELP_OPEN_PATHS = [
  TARIFFS_MODULE_BASE_PATH,
  TARIFF_CONTRACTS_DIRECTORY_PATH,
  TARIFF_NEW_CONTRACT_PATH,
  TARIFF_RATE_LOOKUP_PATH,
  TARIFF_RATING_PATH,
  TARIFF_PROVIDERS_PATH,
  TARIFF_LEGAL_ENTITIES_PATH,
  TARIFF_IMPORT_PATH,
  TARIFF_IMPORT_NEW_PATH,
  TARIFF_GEOGRAPHY_PATH,
  TARIFF_GEOGRAPHY_NEW_PATH,
  TARIFF_CHARGE_CODES_PATH,
] as const;

export type TariffHelpOpenPath = (typeof TARIFF_HELP_OPEN_PATHS)[number];

/** Single contract header (not a version workbench). */
export function tariffContractHeaderPath(contractHeaderId: string): string {
  return `${TARIFF_CONTRACTS_DIRECTORY_PATH}/${contractHeaderId}`;
}

/** Lane rating explorer; optional `shipmentId` enables hints, apply, and linked-version panel. */
export function tariffLaneRatingPath(options?: { shipmentId?: string | null }): string {
  const sid = options?.shipmentId?.trim();
  if (sid) return `${TARIFF_RATING_PATH}?shipmentId=${encodeURIComponent(sid)}`;
  return TARIFF_RATING_PATH;
}

/** Path to the tariff contract version workbench. Preserves optional logistics `shipmentId` for deep links. */
export function tariffContractVersionPath(
  contractHeaderId: string,
  contractVersionId: string,
  options?: { shipmentId?: string | null },
): string {
  const base = `${TARIFF_CONTRACTS_DIRECTORY_PATH}/${contractHeaderId}/versions/${contractVersionId}`;
  const sid = options?.shipmentId?.trim();
  if (sid) return `${base}?shipmentId=${encodeURIComponent(sid)}`;
  return base;
}

export function tariffGeographyGroupPath(groupId: string): string {
  return `${TARIFF_GEOGRAPHY_PATH}/${groupId}`;
}

export function tariffImportBatchPath(batchId: string): string {
  return `${TARIFF_IMPORT_PATH}/${batchId}`;
}
