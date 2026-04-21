import type { ApiHubValidationIssue } from "@/lib/apihub/api-error";
import {
  APIHUB_INGESTION_ATTEMPT_RANGE_MAX,
  APIHUB_INGESTION_TRIGGER_KINDS,
} from "@/lib/apihub/constants";

const CONNECTOR_ID_PATTERN = /^[a-z0-9]{12,64}$/i;

export type IngestionRunAttemptRange = { min: number; max: number };

function pushIssue(issues: ApiHubValidationIssue[], field: string, code: string, message: string) {
  issues.push({ field, code, message });
}

/** Non-empty connector id for `GET …/ingestion-jobs?connectorId=` (tenant ownership checked separately). */
export function parseIngestionRunListConnectorIdParam(raw: string | null): {
  ok: true;
  connectorId: string | null;
} | { ok: false; issues: ApiHubValidationIssue[] } {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) {
    return { ok: true, connectorId: null };
  }
  if (!CONNECTOR_ID_PATTERN.test(trimmed)) {
    return {
      ok: false,
      issues: [
        {
          field: "connectorId",
          code: "INVALID_FORMAT",
          message: "connectorId must be a non-empty alphanumeric id (12–64 characters).",
        },
      ],
    };
  }
  return { ok: true, connectorId: trimmed };
}

export function parseIngestionRunListTriggerKindParam(raw: string | null): {
  ok: true;
  triggerKind: string | null;
} | { ok: false; issues: ApiHubValidationIssue[] } {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (trimmed.length === 0) {
    return { ok: true, triggerKind: null };
  }
  if (!APIHUB_INGESTION_TRIGGER_KINDS.includes(trimmed as (typeof APIHUB_INGESTION_TRIGGER_KINDS)[number])) {
    return {
      ok: false,
      issues: [
        {
          field: "triggerKind",
          code: "INVALID_ENUM",
          message: `triggerKind must be one of: ${APIHUB_INGESTION_TRIGGER_KINDS.join(", ")}.`,
        },
      ],
    };
  }
  return { ok: true, triggerKind: trimmed };
}

/**
 * `attemptRange`: single attempt `2`, or inclusive range `1-3` (bounds 1…{@link APIHUB_INGESTION_ATTEMPT_RANGE_MAX}).
 */
export function parseIngestionRunListAttemptRangeParam(raw: string | null): {
  ok: true;
  attemptRange: IngestionRunAttemptRange | null;
} | { ok: false; issues: ApiHubValidationIssue[] } {
  const trimmed = (raw ?? "").trim();
  if (trimmed.length === 0) {
    return { ok: true, attemptRange: null };
  }
  const issues: ApiHubValidationIssue[] = [];
  const single = /^(\d+)$/.exec(trimmed);
  const range = /^(\d+)-(\d+)$/.exec(trimmed);
  let min: number;
  let max: number;
  if (single) {
    min = Number(single[1]);
    max = min;
  } else if (range) {
    min = Number(range[1]);
    max = Number(range[2]);
  } else {
    pushIssue(
      issues,
      "attemptRange",
      "INVALID_FORMAT",
      "attemptRange must be a single positive integer (e.g. 2) or inclusive range min-max (e.g. 1-3).",
    );
    return { ok: false, issues };
  }
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    pushIssue(issues, "attemptRange", "INVALID_NUMBER", "attemptRange bounds must be integers.");
    return { ok: false, issues };
  }
  if (min < 1 || max > APIHUB_INGESTION_ATTEMPT_RANGE_MAX) {
    pushIssue(
      issues,
      "attemptRange",
      "OUT_OF_RANGE",
      `attempt must stay within 1 and ${APIHUB_INGESTION_ATTEMPT_RANGE_MAX}.`,
    );
    return { ok: false, issues };
  }
  if (min > max) {
    pushIssue(issues, "attemptRange", "INVALID_RANGE", "attemptRange min must be less than or equal to max.");
    return { ok: false, issues };
  }
  return { ok: true, attemptRange: { min, max } };
}
