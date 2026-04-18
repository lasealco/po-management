import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { auditOceanInvoiceLine } from "@/lib/invoice-audit/ocean-line-match";
import { extractSnapshotPriceCandidates } from "@/lib/invoice-audit/snapshot-candidates";

/**
 * End-to-end through matcher stack without Prisma/DB: proves extract + audit wiring stays runnable in CI.
 */
describe("invoice audit pipeline (no DB)", () => {
  it("extracts RFQ candidates then matches an itemized line within tolerance", () => {
    const breakdown = {
      sourceType: "QUOTE_RESPONSE",
      quoteRequest: {
        originLabel: "Port USNYC",
        destinationLabel: "DEHAM",
      },
      lines: [
        {
          id: "l1",
          lineType: "FREIGHT",
          label: "Ocean FCL 40HC base",
          amount: "2500",
          currency: "USD",
          unitBasis: "PER_CONTAINER",
          isIncluded: false,
          notes: "",
        },
      ],
      totals: { grand: 2500 },
    };

    const extracted = extractSnapshotPriceCandidates(breakdown);
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;

    expect(extracted.rfqRouteLocodes).toEqual({ pol: "USNYC", pod: "DEHAM" });
    expect(extracted.candidates[0]!.originCode).toBe("USNYC");

    const r = auditOceanInvoiceLine({
      invoiceLine: {
        rawDescription: "Ocean FCL 40HC base freight",
        normalizedLabel: null,
        currency: "USD",
        amount: new Prisma.Decimal("2500"),
        unitBasis: "PER_CONTAINER",
        equipmentType: "40HC",
        chargeStructureHint: "ITEMIZED",
      },
      intake: { polCode: "USNYC", podCode: "DEHAM" },
      candidates: extracted.candidates,
      snapshotSourceType: extracted.sourceType,
      rfqGrandTotal: extracted.rfqGrandTotal,
      contractGrandTotal: extracted.contractGrandTotal,
      aliases: [],
      amountAbsTolerance: 25,
      percentTolerance: 0.015,
      toleranceRuleId: "test-rule",
      invoiceLineCount: 1,
    });

    expect(r.outcome).toBe("GREEN");
    expect(r.snapshotMatchedJson).toMatchObject({ id: "l1", kind: "RFQ_LINE" });
  });

  it("extracts contract candidates then matches THC charge", () => {
    const breakdown = {
      sourceType: "TARIFF_CONTRACT_VERSION",
      rateLines: [
        {
          id: "r1",
          rateType: "FCL",
          equipmentType: "40HC",
          unitBasis: "PER_CONTAINER",
          currency: "USD",
          amount: "2000",
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
      totals: { grand: 2185 },
    };

    const extracted = extractSnapshotPriceCandidates(breakdown);
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;

    const r = auditOceanInvoiceLine({
      invoiceLine: {
        rawDescription: "Terminal handling origin",
        normalizedLabel: null,
        currency: "USD",
        amount: new Prisma.Decimal("185"),
        unitBasis: null,
        equipmentType: null,
        chargeStructureHint: "ITEMIZED",
      },
      intake: { polCode: "USNYC", podCode: null },
      candidates: extracted.candidates,
      snapshotSourceType: extracted.sourceType,
      rfqGrandTotal: extracted.rfqGrandTotal,
      contractGrandTotal: extracted.contractGrandTotal,
      aliases: [],
      amountAbsTolerance: 25,
      percentTolerance: 0.015,
      toleranceRuleId: "test-rule",
      invoiceLineCount: 2,
    });

    expect(r.outcome).toBe("GREEN");
    expect(r.snapshotMatchedJson).toMatchObject({ id: "c1", kind: "CONTRACT_CHARGE" });
  });
});
