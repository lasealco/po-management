import { APIHUB_STAGING_BATCH_MAX_ROWS } from "@/lib/apihub/constants";
import type { ApiHubMappedApplyRow } from "@/lib/apihub/downstream-mapped-rows-apply";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function readRowIndex(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.trunc(v);
  }
  return fallback;
}

/**
 * Parses `rows` / `applyRows` from a succeeded run's `resultSummary` JSON string (if the pipeline
 * stored structured output). Shape: `{ "rows": [ { "rowIndex"?: number, "mappedRecord": object } ] }`.
 */
export function parseIngestionRunApplyRowsFromResultSummary(
  resultSummary: string | null,
): ApiHubMappedApplyRow[] | null {
  if (resultSummary == null || !String(resultSummary).trim()) {
    return null;
  }
  let obj: unknown;
  try {
    obj = JSON.parse(String(resultSummary)) as unknown;
  } catch {
    return null;
  }
  const rec = asRecord(obj);
  if (!rec) {
    return null;
  }
  const rawRows = rec.rows ?? rec.applyRows;
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return null;
  }
  return normalizeRawRowsArray(rawRows);
}

export function normalizeIngestionApplyRowsFromBody(raw: unknown): { ok: true; rows: ApiHubMappedApplyRow[] } | { ok: false; message: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, message: "rows must be a non-empty array when provided." };
  }
  if (raw.length === 0) {
    return { ok: false, message: "rows must be a non-empty array when provided." };
  }
  try {
    return { ok: true, rows: normalizeRawRowsArray(raw) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid rows.";
    return { ok: false, message: msg };
  }
}

function normalizeRawRowsArray(rawRows: unknown[]): ApiHubMappedApplyRow[] {
  if (rawRows.length > APIHUB_STAGING_BATCH_MAX_ROWS) {
    throw new Error(`At most ${APIHUB_STAGING_BATCH_MAX_ROWS} rows per apply.`);
  }
  const out: ApiHubMappedApplyRow[] = [];
  rawRows.forEach((item, i) => {
    const rec = asRecord(item);
    if (!rec || !Object.prototype.hasOwnProperty.call(rec, "mappedRecord")) {
      throw new Error(`rows[${i}] must be an object with mappedRecord.`);
    }
    out.push({
      rowIndex: readRowIndex(rec.rowIndex, i),
      mappedRecord: rec.mappedRecord,
    });
  });
  return out;
}

export function resolveIngestionApplyMappedRows(input: {
  bodyRows: unknown | undefined;
  resultSummary: string | null;
}):
  | { ok: true; rows: ApiHubMappedApplyRow[]; source: "body" | "resultSummary" }
  | { ok: false; message: string } {
  if (input.bodyRows !== undefined) {
    const parsed = normalizeIngestionApplyRowsFromBody(input.bodyRows);
    if (!parsed.ok) {
      return parsed;
    }
    return { ok: true, rows: parsed.rows, source: "body" };
  }
  const fromSummary = parseIngestionRunApplyRowsFromResultSummary(input.resultSummary);
  if (!fromSummary || fromSummary.length === 0) {
    return {
      ok: false,
      message:
        "Downstream apply requires `rows` in the request body or a JSON `resultSummary` with a non-empty `rows` (or `applyRows`) array.",
    };
  }
  return { ok: true, rows: fromSummary, source: "resultSummary" };
}
