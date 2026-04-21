import type { ApiHubIngestionRunRow } from "@/lib/apihub/ingestion-runs-repo";

/** Downstream-style row counts returned with apply (Slice 43). */
export type ApplyTargetSummary = {
  created: number;
  updated: number;
  skipped: number;
};

const MAX_COUNT = 1_000_000_000;

function readNonNegativeInt(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    return null;
  }
  const n = Math.trunc(v);
  if (n < 0 || n > MAX_COUNT) {
    return null;
  }
  return n;
}

function tryParseResultSummaryCounts(raw: string | null): ApplyTargetSummary | null {
  if (raw == null || !String(raw).trim()) {
    return null;
  }
  let obj: unknown;
  try {
    obj = JSON.parse(String(raw)) as unknown;
  } catch {
    return null;
  }
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) {
    return null;
  }
  const rec = obj as Record<string, unknown>;
  const nested =
    rec.targetSummary != null && typeof rec.targetSummary === "object" && !Array.isArray(rec.targetSummary)
      ? (rec.targetSummary as Record<string, unknown>)
      : rec;
  const c = readNonNegativeInt(nested.created);
  const u = readNonNegativeInt(nested.updated);
  const s = readNonNegativeInt(nested.skipped);
  if (c === null && u === null && s === null) {
    return null;
  }
  return {
    created: c ?? 0,
    updated: u ?? 0,
    skipped: s ?? 0,
  };
}

/**
 * Resolves apply target counts: prefers numeric `created` / `updated` / `skipped` from the run's
 * `resultSummary` JSON (top-level or under `targetSummary`). Otherwise defaults to one logical
 * **update** (the apply marker) until downstream apply wiring emits real counts.
 */
export function resolveApplyTargetSummary(run: Pick<ApiHubIngestionRunRow, "resultSummary">): ApplyTargetSummary {
  const parsed = tryParseResultSummaryCounts(run.resultSummary);
  if (parsed) {
    return parsed;
  }
  return { created: 0, updated: 1, skipped: 0 };
}

/** Counts that would be reported if apply succeeded (dry-run); zero when apply would not run. */
export function resolveDryRunTargetSummary(
  wouldApply: boolean,
  run: Pick<ApiHubIngestionRunRow, "resultSummary">,
): ApplyTargetSummary {
  if (!wouldApply) {
    return { created: 0, updated: 0, skipped: 0 };
  }
  return resolveApplyTargetSummary(run);
}
