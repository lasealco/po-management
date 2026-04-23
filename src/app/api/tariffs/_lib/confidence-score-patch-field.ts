/**
 * Shared validation for import batch / staging row PATCH bodies (`confidenceScore` on `Decimal(5,2)` fields).
 */
export type ConfidenceScorePatch = { confidenceScore: number | null };

export function confidenceScoreFromPatchBody(o: Record<string, unknown>):
  | { ok: true; patch: ConfidenceScorePatch | Record<string, never> }
  | { ok: false; message: string } {
  if (!("confidenceScore" in o)) return { ok: true, patch: {} };
  const v = o.confidenceScore;
  if (v !== null && typeof v !== "number") {
    return { ok: false, message: "confidenceScore must be a finite number or null." };
  }
  if (v !== null && (!Number.isFinite(v) || v < 0 || v > 100)) {
    return { ok: false, message: "confidenceScore must be between 0 and 100 (inclusive) or null." };
  }
  return { ok: true, patch: { confidenceScore: v === null ? null : v } };
}
