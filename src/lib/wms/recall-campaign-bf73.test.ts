import { describe, expect, it } from "vitest";

import {
  parseRecallScopeFromWmsBody,
  parseStoredRecallScopeJson,
  RECALL_SCOPE_SCHEMA_VERSION,
  recallHoldSummaryNote,
} from "./recall-campaign-bf73";

describe("recall-campaign-bf73", () => {
  it("parses scope lists from WMS body", () => {
    const res = parseRecallScopeFromWmsBody({
      recallScopeWarehouseIds: [" wh1 ", "wh1", "wh2"],
      recallScopeProductIds: ["p1"],
      recallScopeLotCodes: [" L1 ", "L1"],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.scope.schemaVersion).toBe(RECALL_SCOPE_SCHEMA_VERSION);
    expect(res.scope.warehouseIds).toEqual(["wh1", "wh2"]);
    expect(res.scope.productIds).toEqual(["p1"]);
    expect(res.scope.lotCodes).toEqual(["L1"]);
  });

  it("rejects empty warehouse scope", () => {
    const res = parseRecallScopeFromWmsBody({
      recallScopeWarehouseIds: [],
      recallScopeProductIds: ["p1"],
    });
    expect(res.ok).toBe(false);
  });

  it("parses stored JSON round-trip", () => {
    const doc = {
      schemaVersion: RECALL_SCOPE_SCHEMA_VERSION,
      warehouseIds: ["w1"],
      productIds: ["p1", "p2"],
      lotCodes: ["LOT-A"],
    };
    const parsed = parseStoredRecallScopeJson(doc);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.scope).toEqual(doc);
  });

  it("rejects wrong schema version in storage", () => {
    const res = parseStoredRecallScopeJson({
      schemaVersion: "bf72.v1",
      warehouseIds: ["w1"],
      productIds: ["p1"],
    });
    expect(res.ok).toBe(false);
  });

  it("builds hold summary note capped at 500 chars", () => {
    const long = "x".repeat(600);
    const n = recallHoldSummaryNote("RC-1", "Title", long);
    expect(n.length).toBe(500);
    expect(n.startsWith("Recall RC-1")).toBe(true);
  });
});
