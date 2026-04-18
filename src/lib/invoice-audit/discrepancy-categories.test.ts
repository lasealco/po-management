import { describe, expect, it } from "vitest";

import { DISCREPANCY_CATEGORY, formatDiscrepancyCategoryLabel } from "@/lib/invoice-audit/discrepancy-categories";

describe("formatDiscrepancyCategoryLabel", () => {
  it("maps known category keys", () => {
    expect(formatDiscrepancyCategoryLabel(DISCREPANCY_CATEGORY.AMOUNT_MAJOR_DISCREPANCY)).toContain("major");
    expect(formatDiscrepancyCategoryLabel(DISCREPANCY_CATEGORY.MATCH_CONFIDENCE_LOW)).toContain("confidence");
  });

  it("falls back for unknown keys", () => {
    expect(formatDiscrepancyCategoryLabel("CUSTOM_VENDOR_CODE")).toBe("custom vendor code");
  });
});
