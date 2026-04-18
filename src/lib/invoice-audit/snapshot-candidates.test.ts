import { describe, expect, it } from "vitest";

import { DISCREPANCY_CATEGORY } from "@/lib/invoice-audit/discrepancy-categories";
import { extractSnapshotPriceCandidates } from "@/lib/invoice-audit/snapshot-candidates";

describe("extractSnapshotPriceCandidates", () => {
  it("parses TARIFF_CONTRACT_VERSION rate and charge lines", () => {
    const out = extractSnapshotPriceCandidates({
      sourceType: "TARIFF_CONTRACT_VERSION",
      rateLines: [
        {
          id: "r1",
          rateType: "FCL",
          equipmentType: "40HC",
          unitBasis: "PER_CONTAINER",
          currency: "USD",
          amount: "2100",
          originScope: { code: "USNYC" },
          destinationScope: { code: "DEHAM" },
        },
      ],
      chargeLines: [
        {
          id: "c1",
          rawChargeName: "THC origin",
          normalizedCode: "THC",
          equipmentScope: "40HC",
          unitBasis: "PER_CONTAINER",
          currency: "USD",
          amount: "185",
          isIncluded: false,
          isMandatory: true,
          geographyScope: { code: "USNYC" },
        },
      ],
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.sourceType).toBe("TARIFF_CONTRACT_VERSION");
    expect(out.rfqGrandTotal).toBeNull();
    const rates = out.candidates.filter((c) => c.kind === "CONTRACT_RATE");
    const charges = out.candidates.filter((c) => c.kind === "CONTRACT_CHARGE");
    expect(rates).toHaveLength(1);
    expect(rates[0]!.equipmentHint).toBe("40HC");
    expect(rates[0]!.originCode).toBe("USNYC");
    expect(rates[0]!.destCode).toBe("DEHAM");
    expect(charges).toHaveLength(1);
    expect(charges[0]!.label).toContain("THC");
    expect(charges[0]!.equipmentHint).toBe("40HC");
    expect(charges[0]!.originCode).toBe("USNYC");
  });

  it("parses QUOTE_RESPONSE lines and totals.grand", () => {
    const out = extractSnapshotPriceCandidates({
      sourceType: "QUOTE_RESPONSE",
      lines: [
        {
          id: "l1",
          lineType: "FREIGHT",
          label: "Ocean FCL 40HC",
          amount: "3200",
          currency: "USD",
          unitBasis: "PER_CONTAINER",
          isIncluded: false,
          notes: "",
        },
      ],
      totals: { grand: 3250 },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.rfqGrandTotal).toBe(3250);
    expect(out.candidates[0]!.kind).toBe("RFQ_LINE");
    expect(out.candidates[0]!.equipmentHint).toBe("40HC");
  });

  it("fails on unknown sourceType", () => {
    const out = extractSnapshotPriceCandidates({ sourceType: "OTHER", rateLines: [] });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.category).toBe(DISCREPANCY_CATEGORY.SNAPSHOT_PARSE_ERROR);
  });
});
