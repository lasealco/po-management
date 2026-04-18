import { describe, expect, it } from "vitest";

import { formatSnapshotMatchLabel } from "@/lib/invoice-audit/snapshot-match-label";

describe("formatSnapshotMatchLabel", () => {
  it("summarizes itemized match JSON", () => {
    expect(
      formatSnapshotMatchLabel({
        kind: "CONTRACT_CHARGE",
        id: "c1",
        label: "THC origin",
        expectedAmount: 185,
      }),
    ).toBe("CONTRACT_CHARGE: THC origin");
  });

  it("summarizes currency mismatch payloads", () => {
    expect(
      formatSnapshotMatchLabel({
        invoiceCurrency: "USD",
        snapshotCurrencies: ["EUR"],
      }),
    ).toBe("Currency mismatch (invoice USD)");
  });

  it("summarizes all-in contract grand mode", () => {
    expect(
      formatSnapshotMatchLabel({
        mode: "CONTRACT_BREAKDOWN_GRAND",
        expectedAmount: 5000,
      }),
    ).toBe("All-in vs contract grand (5000)");
  });

  it("summarizes all-in no-basket payloads", () => {
    expect(
      formatSnapshotMatchLabel({
        mode: "CONTRACT_BASKET_SUM",
        reason: "NO_BASKET_COMPONENTS",
      }),
    ).toBe("All-in: no basket built (CONTRACT_BASKET_SUM)");
  });

  it("summarizes empty scoring pool", () => {
    expect(formatSnapshotMatchLabel({ topScores: [] })).toBe("No viable matches after scoring");
  });

  it("includes invoice equipment on empty-pool summaries", () => {
    expect(
      formatSnapshotMatchLabel({
        invoiceEquipment: "40HC",
        reason: "EMPTY_POOL_AFTER_FILTERS",
      }),
    ).toBe("No eligible lines after filters (invoice equipment 40HC)");
  });

  it("summarizes low-confidence scoring with the best candidate label", () => {
    expect(
      formatSnapshotMatchLabel({
        topScores: [
          { id: "c1", label: "THC origin terminal handling", score: 4.2 },
          { id: "c2", label: "Documentation fee", score: 3.1 },
        ],
      }),
    ).toBe('Low confidence — closest "THC origin terminal handling" (score 4.2)');
  });

  it("truncates long labels in low-confidence summaries", () => {
    const long = "A".repeat(50);
    const out = formatSnapshotMatchLabel({
      topScores: [{ id: "x", label: long, score: 2 }],
    });
    expect(out.startsWith('Low confidence — closest "')).toBe(true);
    expect(out).toContain("…");
    expect(out).toMatch(/\(score 2\.0\)$/);
  });
});
