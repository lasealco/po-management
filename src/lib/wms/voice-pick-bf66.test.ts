import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import {
  parseVoicePickPostBody,
  voicePickConfirmToken,
  voicePickQtyMatchesExpected,
  voicePickSkuMatchesConfirm,
} from "./voice-pick-bf66";

describe("voice-pick-bf66", () => {
  it("picks confirm token sku vs code", () => {
    expect(voicePickConfirmToken({ id: "x", sku: " A ", productCode: "B" })).toBe("A");
    expect(voicePickConfirmToken({ id: "abcdefghij", sku: null, productCode: null })).toBe("abcdefgh");
  });

  it("matches confirm string to sku or product code", () => {
    expect(voicePickSkuMatchesConfirm("sku-1", { sku: "SKU-1", productCode: "ALT" })).toBe(true);
    expect(voicePickSkuMatchesConfirm("alt", { sku: "X", productCode: "ALT" })).toBe(true);
    expect(voicePickSkuMatchesConfirm("x", { sku: "Y", productCode: "Z" })).toBe(false);
  });

  it("compares qty to decimal task quantity", () => {
    expect(voicePickQtyMatchesExpected(new Prisma.Decimal("12.000"), 12)).toBe(true);
    expect(voicePickQtyMatchesExpected(new Prisma.Decimal("12.000"), 11)).toBe(false);
  });

  it("parses POST body", () => {
    const bad = parseVoicePickPostBody(null);
    expect(bad.ok).toBe(false);
    const ok = parseVoicePickPostBody({
      picks: [{ taskId: "t1", confirmSku: "SKU", qtySpoken: 3 }],
    });
    expect(ok.ok && ok.picks).toEqual([{ taskId: "t1", confirmSku: "SKU", qtySpoken: 3 }]);
    const dup = parseVoicePickPostBody({
      picks: [
        { taskId: "t1", confirmSku: "A", qtySpoken: 1 },
        { taskId: "t1", confirmSku: "B", qtySpoken: 1 },
      ],
    });
    expect(dup.ok).toBe(false);
  });
});
