import { describe, expect, it } from "vitest";

import { FUNGIBLE_LOT_CODE } from "./lot-code";
import { parseStockTransferLineInput, truncateStockTransferNote } from "./stock-transfer";

describe("BF-55 stock transfer helpers", () => {
  it("parses a valid line", () => {
    const p = parseStockTransferLineInput({
      productId: "p1",
      fromBinId: "b1",
      quantity: 3.5,
    });
    expect(p).toMatchObject({
      productId: "p1",
      fromBinId: "b1",
      lotCode: FUNGIBLE_LOT_CODE,
    });
    expect(p?.quantity.toString()).toBe("3.5");
  });

  it("normalizes lot code", () => {
    const p = parseStockTransferLineInput({
      productId: "p1",
      fromBinId: "b1",
      quantity: 1,
      lotCode: "  lot-a  ",
    });
    expect(p?.lotCode).toBe("lot-a");
  });

  it("rejects bad rows", () => {
    expect(parseStockTransferLineInput(null)).toBeNull();
    expect(parseStockTransferLineInput({})).toBeNull();
    expect(parseStockTransferLineInput({ productId: "p", fromBinId: "", quantity: 1 })).toBeNull();
    expect(parseStockTransferLineInput({ productId: "p", fromBinId: "b", quantity: 0 })).toBeNull();
  });

  it("truncates notes", () => {
    expect(truncateStockTransferNote("  ")).toBeNull();
    expect(truncateStockTransferNote("x".repeat(600))?.length).toBe(500);
  });
});
