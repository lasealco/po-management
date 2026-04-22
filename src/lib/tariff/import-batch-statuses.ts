/** Batch-level parser lifecycle (strings in DB; no enum yet). */
export const TARIFF_IMPORT_PARSE_STATUSES = [
  "UPLOADED",
  "QUEUED",
  "PARSING",
  "PARSED_OK",
  "PARSED_PARTIAL",
  "PARSED_FAILED",
  "NO_ROWS",
] as const;

export type TariffImportParseStatus = (typeof TARIFF_IMPORT_PARSE_STATUSES)[number];

/** Human review / apply workflow. */
export const TARIFF_IMPORT_REVIEW_STATUSES = [
  "PENDING",
  "IN_REVIEW",
  "READY_TO_APPLY",
  "APPLIED",
  "REJECTED",
] as const;

export type TariffImportReviewStatus = (typeof TARIFF_IMPORT_REVIEW_STATUSES)[number];

/** Fast membership checks for repo/API validation (avoid ad-hoc string sets). */
export const TARIFF_IMPORT_PARSE_STATUS_SET = new Set<string>(TARIFF_IMPORT_PARSE_STATUSES);
export const TARIFF_IMPORT_REVIEW_STATUS_SET = new Set<string>(TARIFF_IMPORT_REVIEW_STATUSES);

export function parseStatusLabel(s: string): string {
  const map: Record<string, string> = {
    UPLOADED: "Uploaded",
    QUEUED: "Queued",
    PARSING: "Parsing",
    PARSED_OK: "Parsed",
    PARSED_PARTIAL: "Parsed (partial)",
    PARSED_FAILED: "Parse failed",
    NO_ROWS: "No rows",
  };
  return map[s] ?? s;
}

export function reviewStatusLabel(s: string): string {
  const map: Record<string, string> = {
    PENDING: "Pending review",
    IN_REVIEW: "In review",
    READY_TO_APPLY: "Ready to apply",
    APPLIED: "Applied",
    REJECTED: "Rejected",
  };
  return map[s] ?? s;
}

/**
 * Documented keys for `TariffImportStagingRow.rawPayload` (future parser / mapper).
 * Keep values in JSON until dedicated columns are justified.
 */
export {
  TARIFF_IMPORT_STAGING_ROW_TYPES,
  TARIFF_IMPORT_STAGING_ROW_TYPE_SET,
  TARIFF_IMPORT_NORMALIZED_PAYLOAD_KEYS,
} from "@/lib/tariff/import-pipeline";

export const STAGING_RAW_PAYLOAD_KEYS = {
  /** Raw carrier / sheet charge label before normalization. */
  rawChargeName: "rawChargeName",
  /** Free-text origin geography from source. */
  rawGeoOriginLabel: "rawGeoOriginLabel",
  /** Free-text destination geography from source. */
  rawGeoDestinationLabel: "rawGeoDestinationLabel",
  /** Optional sheet row / page reference. */
  sourceRowRef: "sourceRowRef",
} as const;
