import type { ApiHubValidationIssue } from "@/lib/apihub/api-error";
import {
  APIHUB_MAPPING_ANALYSIS_MAX_RECORDS,
  APIHUB_MAPPING_ANALYSIS_NOTE_MAX,
  APIHUB_MAPPING_ANALYSIS_TARGET_FIELDS_MAX,
} from "@/lib/apihub/constants";

export type ApiHubMappingAnalysisJobCreateBody = {
  records?: unknown;
  targetFields?: unknown;
  note?: unknown;
};

export type ParsedApiHubMappingAnalysisJobCreate = {
  schemaVersion: 1;
  records: Record<string, unknown>[];
  targetFields: string[] | null;
  note: string | null;
};

export function parseApiHubMappingAnalysisJobCreateBody(
  body: ApiHubMappingAnalysisJobCreateBody,
):
  | { ok: true; value: ParsedApiHubMappingAnalysisJobCreate }
  | { ok: false; issues: ApiHubValidationIssue[] } {
  const issues: ApiHubValidationIssue[] = [];

  const recordsRaw = body.records;
  if (!Array.isArray(recordsRaw)) {
    issues.push({
      field: "records",
      code: "INVALID_TYPE",
      message: "records must be an array of objects.",
      severity: "error",
    });
  } else if (recordsRaw.length === 0) {
    issues.push({
      field: "records",
      code: "OUT_OF_RANGE",
      message: "records must not be empty.",
      severity: "error",
    });
  } else if (recordsRaw.length > APIHUB_MAPPING_ANALYSIS_MAX_RECORDS) {
    issues.push({
      field: "records",
      code: "OUT_OF_RANGE",
      message: `records length must be at most ${APIHUB_MAPPING_ANALYSIS_MAX_RECORDS}.`,
      severity: "error",
    });
  } else if (!recordsRaw.every((r) => r != null && typeof r === "object" && !Array.isArray(r))) {
    issues.push({
      field: "records",
      code: "INVALID_TYPE",
      message: "Each record must be a plain object.",
      severity: "error",
    });
  }

  let targetFields: string[] | null = null;
  if (body.targetFields !== undefined && body.targetFields !== null) {
    if (!Array.isArray(body.targetFields)) {
      issues.push({
        field: "targetFields",
        code: "INVALID_TYPE",
        message: "targetFields must be an array of strings when provided.",
        severity: "error",
      });
    } else {
      const tf = body.targetFields
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean);
      if (tf.length > APIHUB_MAPPING_ANALYSIS_TARGET_FIELDS_MAX) {
        issues.push({
          field: "targetFields",
          code: "OUT_OF_RANGE",
          message: `At most ${APIHUB_MAPPING_ANALYSIS_TARGET_FIELDS_MAX} target field hints.`,
          severity: "error",
        });
      } else {
        targetFields = tf.length ? tf : null;
      }
    }
  }

  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string") {
      issues.push({
        field: "note",
        code: "INVALID_TYPE",
        message: "note must be a string when provided.",
        severity: "error",
      });
    } else {
      const t = body.note.trim();
      if (t.length > APIHUB_MAPPING_ANALYSIS_NOTE_MAX) {
        issues.push({
          field: "note",
          code: "OUT_OF_RANGE",
          message: `note must be at most ${APIHUB_MAPPING_ANALYSIS_NOTE_MAX} characters.`,
          severity: "error",
        });
      } else {
        note = t.length ? t : null;
      }
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const records = recordsRaw as Record<string, unknown>[];

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      records,
      targetFields,
      note,
    },
  };
}
