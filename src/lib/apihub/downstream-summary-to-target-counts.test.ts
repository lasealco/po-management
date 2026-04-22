import { describe, expect, it } from "vitest";

import { downstreamSummaryToTargetCounts } from "./downstream-mapped-rows-apply";

describe("downstreamSummaryToTargetCounts", () => {
  it("splits created vs updated from applyOp", () => {
    expect(
      downstreamSummaryToTargetCounts({
        target: "sales_order",
        dryRun: false,
        rows: [
          { rowIndex: 0, ok: true, applyOp: "created" },
          { rowIndex: 1, ok: true, applyOp: "updated" },
          { rowIndex: 2, ok: false, error: "x" },
        ],
      }),
    ).toEqual({ created: 1, updated: 1, skipped: 0 });
  });

  it("treats missing applyOp as created", () => {
    expect(
      downstreamSummaryToTargetCounts({
        target: "control_tower_audit",
        dryRun: false,
        rows: [{ rowIndex: 0, ok: true, entityId: "1" }],
      }),
    ).toEqual({ created: 1, updated: 0, skipped: 0 });
  });
});
