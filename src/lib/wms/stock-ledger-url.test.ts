import { describe, expect, it } from "vitest";

import {
  isoToDatetimeLocalValue,
  mergeStockLedgerSearchParams,
  normalizeMovementLedgerQueryString,
  readStockLedgerUrlState,
} from "@/lib/wms/stock-ledger-url";

describe("normalizeMovementLedgerQueryString", () => {
  it("keeps only mv* keys, drops empties, and sorts", () => {
    const sp = new URLSearchParams(
      "onHold=1&mvLimit=&mvType=PICK&foo=bar&mvWarehouse=w1&mvSince=&mvUntil=2024-01-02T00:00:00.000Z",
    );
    expect(normalizeMovementLedgerQueryString(sp)).toBe(
      "mvType=PICK&mvUntil=" + encodeURIComponent("2024-01-02T00:00:00.000Z") + "&mvWarehouse=w1",
    );
  });

  it("orders keys lexicographically", () => {
    const sp = new URLSearchParams("mvWarehouse=a&mvType=RECEIPT");
    expect(normalizeMovementLedgerQueryString(sp)).toBe("mvType=RECEIPT&mvWarehouse=a");
  });
});

describe("readStockLedgerUrlState", () => {
  it("reads known movement types and clears unknown mvType", () => {
    const ok = new URLSearchParams("mvType=PICK&mvWarehouse=wh");
    expect(readStockLedgerUrlState(ok).movementType).toBe("PICK");
    expect(readStockLedgerUrlState(ok).warehouseId).toBe("wh");

    const bad = new URLSearchParams("mvType=NOT_A_TYPE");
    expect(readStockLedgerUrlState(bad).movementType).toBe("");
  });
});

describe("mergeStockLedgerSearchParams", () => {
  it("replaces mv* keys and preserves unrelated params", () => {
    const current = new URLSearchParams("onHold=1&taskType=PICK&mvType=PUTAWAY");
    const merged = mergeStockLedgerSearchParams(current, {
      warehouseId: "w99",
      movementType: "PICK",
      sinceIso: "",
      untilIso: "",
      limit: "120",
    });
    expect(merged.get("onHold")).toBe("1");
    expect(merged.get("taskType")).toBe("PICK");
    expect(merged.get("mvWarehouse")).toBe("w99");
    expect(merged.get("mvType")).toBe("PICK");
    expect(merged.get("mvLimit")).toBe("120");
    expect(merged.has("mvSince")).toBe(false);
  });

  it("removes mv* keys when ledger fields are empty", () => {
    const current = new URLSearchParams("mvType=PICK&mvWarehouse=x&onHold=1");
    const merged = mergeStockLedgerSearchParams(current, {
      warehouseId: "",
      movementType: "",
      sinceIso: "",
      untilIso: "",
      limit: "",
    });
    expect(merged.get("onHold")).toBe("1");
    expect(merged.has("mvType")).toBe(false);
    expect(merged.has("mvWarehouse")).toBe(false);
  });
});

describe("isoToDatetimeLocalValue", () => {
  it("returns empty for invalid iso", () => {
    expect(isoToDatetimeLocalValue("")).toBe("");
    expect(isoToDatetimeLocalValue("not-a-date")).toBe("");
  });

  it("formats UTC instant in local calendar components", () => {
    const v = isoToDatetimeLocalValue("2024-06-15T14:30:00.000Z");
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
