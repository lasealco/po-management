import { describe, expect, it } from "vitest";

import {
  BF84_MULTIPLIER_MAX,
  effectiveForecastQtyBf84,
  parsePromoUpliftBf84Lenient,
  validatePromoUpliftBf84Post,
} from "@/lib/wms/promo-uplift-bf84";

describe("promo-uplift-bf84", () => {
  it("lenient parse clamps multiplier", () => {
    const p = parsePromoUpliftBf84Lenient({ upliftMultiplier: 99 });
    expect(p.upliftMultiplier).toBe(BF84_MULTIPLIER_MAX);
    const q = parsePromoUpliftBf84Lenient({ upliftMultiplier: 0.5 });
    expect(q.upliftMultiplier).toBe(1);
  });

  it("effective forecast scales base qty", () => {
    expect(effectiveForecastQtyBf84(100, { upliftMultiplier: 1.25 })).toBe(125);
    expect(effectiveForecastQtyBf84(10, null)).toBe(10);
  });

  it("POST validation rejects out of range", () => {
    const bad = validatePromoUpliftBf84Post({ upliftMultiplier: 6 });
    expect(bad.ok).toBe(false);
    const ok = validatePromoUpliftBf84Post({ upliftMultiplier: 2, promoNote: "Spring" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.stored?.upliftMultiplier).toBe(2);
    const note = validatePromoUpliftBf84Post({ upliftMultiplier: 1, promoNote: "EOSS" });
    expect(note.ok).toBe(true);
    if (note.ok) expect(note.stored?.promoNote).toBe("EOSS");
    const trivial = validatePromoUpliftBf84Post({ upliftMultiplier: 1 });
    expect(trivial.ok).toBe(true);
    if (trivial.ok) expect(trivial.stored).toBe(null);
  });
});
