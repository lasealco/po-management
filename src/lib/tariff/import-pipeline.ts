/**
 * Carrier-grade import is not fully implemented yet; this module documents the **intended** ETL stages
 * and stable string constants so parsers, reviewers, and promote jobs can align without ad-hoc literals.
 *
 * Pipeline: **upload → parse → normalize → review → promote → audit**
 *
 * 1. **Upload** — `TariffImportBatch` row + blob URL (`storeTariffImportFile`), `parseStatus=UPLOADED`.
 * 2. **Parse** — worker sets `QUEUED` → `PARSING` → `PARSED_OK` | `PARSED_PARTIAL` | `PARSED_FAILED` (see `TARIFF_IMPORT_PARSE_STATUSES`).
 * 3. **Normalize** — rows in `TariffImportStagingRow` with `rowType` from `TARIFF_IMPORT_STAGING_ROW_TYPES`; `normalizedPayload` holds structured candidate lines.
 * 4. **Review** — human gates via `reviewStatus` (`TARIFF_IMPORT_REVIEW_STATUSES`); unresolved flags in `unresolvedFlags` JSON.
 * 5. **Promote** — transactional creation of `TariffContractVersion` + rate/charge lines + `TariffAuditLog`; batch `APPLIED`.
 * 6. **Audit** — immutable snapshot pointers on version `sourceReference` / `sourceFileUrl`.
 */

/** Values for `TariffImportStagingRow.rowType` (extend as parsers land). */
export const TARIFF_IMPORT_STAGING_ROW_TYPES = [
  "RATE_LINE_CANDIDATE",
  "CHARGE_LINE_CANDIDATE",
  "GEOGRAPHY_ALIAS_CANDIDATE",
  "FREE_TIME_RULE_CANDIDATE",
  "RAW_ROW", // escape hatch before classification
] as const;

export type TariffImportStagingRowType = (typeof TARIFF_IMPORT_STAGING_ROW_TYPES)[number];

export const TARIFF_IMPORT_STAGING_ROW_TYPE_SET = new Set<string>(TARIFF_IMPORT_STAGING_ROW_TYPES);

/** Keys inside `normalizedPayload` once a row is mapped (optional contract). */
export const TARIFF_IMPORT_NORMALIZED_PAYLOAD_KEYS = {
  contractNumber: "contractNumber",
  rateType: "rateType",
  pol: "pol",
  pod: "pod",
  equipment: "equipment",
  currency: "currency",
  amount: "amount",
  chargeCode: "chargeCode",
} as const;
