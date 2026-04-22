/**
 * Carrier-grade import is not fully implemented yet; this module documents the **intended** ETL stages
 * and stable string constants so parsers, reviewers, and promote jobs can align without ad-hoc literals.
 *
 * Pipeline: **upload → parse → normalize → review → promote → audit**
 *
 * 1. **Upload** — `TariffImportBatch` row + blob URL (`storeTariffImportFile`), `parseStatus=UPLOADED`.
 * 2. **Parse** — worker sets `QUEUED` → `PARSING` → `PARSED_OK` | `PARSED_PARTIAL` | `PARSED_FAILED` (see `TARIFF_IMPORT_PARSE_STATUSES` in `import-batch-statuses.ts`).
 * 3. **Normalize** — rows in `TariffImportStagingRow` with `rowType` from `TARIFF_IMPORT_STAGING_ROW_TYPES`; `normalizedPayload` holds structured candidate lines.
 * 4. **Review** — human gates via `reviewStatus` (`TARIFF_IMPORT_REVIEW_STATUSES` in `import-batch-statuses.ts`); unresolved flags in `unresolvedFlags` JSON.
 * 5. **Promote** — transactional creation of `TariffContractVersion` + rate/charge lines + `TariffAuditLog`; batch `reviewStatus` → `APPLIED` (implementation: `promote-staging-import.ts`).
 * 6. **Audit** — immutable snapshot pointers on version `sourceReference` / `sourceFileUrl`; promote writes `TariffAuditLog` with action `import_promote`.
 *
 * ### Promote failure modes (`promoteApprovedStagingRowsToNewVersion`)
 *
 * All thrown as {@link import("./tariff-repo-error").TariffRepoError} with the code below:
 *
 * | Code | When |
 * |------|------|
 * | `CONFLICT` | Batch `reviewStatus` is already `APPLIED`. |
 * | `BAD_INPUT` | `reviewStatus` is not `READY_TO_APPLY`. |
 * | `NOT_FOUND` | `contractHeaderId` does not exist for the tenant. |
 * | `BAD_INPUT` | Two **approved** promotable rows share the same normalized payload fingerprint (duplicate detection). |
 * | `BAD_INPUT` | No approved `RATE_LINE_CANDIDATE` or `CHARGE_LINE_CANDIDATE` rows. |
 * | `BAD_INPUT` | Rate row: missing `rateType` / `unitBasis` / `currency` / valid `amount`, or `rateType` not in Prisma `TariffLineRateType`. |
 * | `BAD_INPUT` | Charge row: missing `rawChargeName` / `unitBasis` / `currency` / valid `amount`. |
 * | `BAD_INPUT` | After processing, every approved row had a non-object `normalizedPayload` or was skipped — zero rate/charge lines created. |
 *
 * On any error **after** the draft version is created, the implementation **best-effort deletes** that version row before rethrowing (lines are cascade-cleaned with the version).
 */

/** Ordered stage ids for docs, UI copy, and tests (not a persisted enum). */
export const TARIFF_IMPORT_PIPELINE_STAGES = [
  "upload",
  "parse",
  "normalize",
  "review",
  "promote",
  "audit",
] as const;

export type TariffImportPipelineStage = (typeof TARIFF_IMPORT_PIPELINE_STAGES)[number];

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
