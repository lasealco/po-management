import { describe, expect, it } from "vitest";

import {
  DISCREPANCY_CATEGORY,
  discrepancyCategoryTone,
  formatDiscrepancyCategoryLabel,
  formatDiscrepancyCategoryReviewHint,
} from "@/lib/invoice-audit/discrepancy-categories";

describe("formatDiscrepancyCategoryLabel", () => {
  it("maps known category keys", () => {
    expect(formatDiscrepancyCategoryLabel(DISCREPANCY_CATEGORY.AMOUNT_MAJOR_DISCREPANCY)).toContain("major");
    expect(formatDiscrepancyCategoryLabel(DISCREPANCY_CATEGORY.MATCH_CONFIDENCE_LOW)).toContain("confidence");
  });

  it("falls back for unknown keys", () => {
    expect(formatDiscrepancyCategoryLabel("CUSTOM_VENDOR_CODE")).toBe("custom vendor code");
  });
});

describe("formatDiscrepancyCategoryReviewHint", () => {
  it("returns a concrete sentence for known keys", () => {
    expect(formatDiscrepancyCategoryReviewHint(DISCREPANCY_CATEGORY.AMOUNT_MAJOR_DISCREPANCY)).toContain("warn band");
  });

  it("falls back for unknown keys", () => {
    expect(formatDiscrepancyCategoryReviewHint("UNKNOWN_X")).toContain("UNKNOWN_X");
  });
});

describe("discrepancyCategoryTone", () => {
  it("classifies tolerance success as neutral", () => {
    expect(discrepancyCategoryTone(DISCREPANCY_CATEGORY.AMOUNT_MATCH_WITHIN_TOLERANCE)).toBe("neutral");
  });

  it("classifies hard failures as critical", () => {
    expect(discrepancyCategoryTone(DISCREPANCY_CATEGORY.NO_SNAPSHOT_LINE_MATCH)).toBe("critical");
  });
});
