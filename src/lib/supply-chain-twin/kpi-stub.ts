/**
 * Slice 21 — non-production KPI placeholder for the Supply Chain Twin preview.
 *
 * The `healthIndex` block is **not** computed from operational graph data, SLAs, or inventory
 * positions. It exists so API clients can depend on a stable shape while real KPI wiring lands.
 * Do not use for production alerting or external reporting.
 */

export type TwinHealthIndexStub = {
  mode: "stub";
  /** 0–100 display-only placeholder (constant until a real KPI engine exists). */
  score: number;
  disclaimer: "non_production";
};

export const TWIN_HEALTH_INDEX_STUB: TwinHealthIndexStub = {
  mode: "stub",
  score: 72,
  disclaimer: "non_production",
};
