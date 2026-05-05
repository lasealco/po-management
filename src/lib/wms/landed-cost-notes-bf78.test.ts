import { describe, expect, it } from "vitest";

import {
  parseStoredLandedCostNotesBf78Json,
  validateLandedCostNotesBf78Draft,
} from "./landed-cost-notes-bf78";

describe("BF-78 landed cost notes", () => {
  it("parses null stored JSON", () => {
    const r = parseStoredLandedCostNotesBf78Json(null);
    expect(r.doc).toBeNull();
    expect(r.notice).toBeNull();
  });

  it("validates FX pair and narrative", () => {
    const ok = validateLandedCostNotesBf78Draft({
      notes: "Allocated freight to SKU pool",
      fxBaseCurrency: "usd",
      fxQuoteCurrency: "EUR",
      fxRate: "1.084",
      fxRateSourceNarrative: "ECB same-day",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.fxBaseCurrency).toBe("USD");
      expect(ok.value.fxQuoteCurrency).toBe("EUR");
      expect(ok.value.fxRate).toBe("1.084");
    }
  });

  it("rejects lone base currency", () => {
    const bad = validateLandedCostNotesBf78Draft({ fxBaseCurrency: "USD" });
    expect(bad.ok).toBe(false);
  });

  it("parses round-trip stored row", () => {
    const doc = validateLandedCostNotesBf78Draft({ notes: "Test" });
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    const again = parseStoredLandedCostNotesBf78Json(doc.value as unknown);
    expect(again.doc?.notes).toBe("Test");
    expect(again.notice).toBeNull();
  });
});
