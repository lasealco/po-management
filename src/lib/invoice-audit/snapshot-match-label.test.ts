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
});
