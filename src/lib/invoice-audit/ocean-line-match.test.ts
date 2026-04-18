import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { DISCREPANCY_CATEGORY } from "@/lib/invoice-audit/discrepancy-categories";
import { auditOceanInvoiceLine } from "@/lib/invoice-audit/ocean-line-match";
import type { SnapshotPriceCandidate } from "@/lib/invoice-audit/snapshot-candidates";

const baseParams = {
  intake: { polCode: null, podCode: null },
  snapshotSourceType: "TARIFF_CONTRACT_VERSION",
  rfqGrandTotal: null as number | null,
  contractGrandTotal: null as number | null,
  aliases: [] as { pattern: string; canonicalTokens: string[]; targetKind: string | null; priority: number }[],
  amountAbsTolerance: 25,
  percentTolerance: 0.015,
  toleranceRuleId: "rule-test",
  invoiceLineCount: 2,
};

function charge(
  partial: Partial<SnapshotPriceCandidate> & Pick<SnapshotPriceCandidate, "id" | "label" | "amount">,
): SnapshotPriceCandidate {
  return {
    kind: "CONTRACT_CHARGE",
    currency: "USD",
    raw: {},
    equipmentHint: null,
    unitBasis: null,
    originCode: null,
    destCode: null,
    isIncluded: false,
    isMandatory: true,
    rateType: null,
    ...partial,
  };
}

function rate(
  partial: Partial<SnapshotPriceCandidate> & Pick<SnapshotPriceCandidate, "id" | "label" | "amount">,
): SnapshotPriceCandidate {
  return {
    kind: "CONTRACT_RATE",
    currency: "USD",
    raw: {},
    equipmentHint: null,
    unitBasis: null,
    originCode: null,
    destCode: null,
    isIncluded: null,
    isMandatory: null,
    rateType: "FAK",
    ...partial,
  };
}

describe("auditOceanInvoiceLine", () => {
  it("returns UNKNOWN with CURRENCY_MISMATCH when snapshot has no lines in invoice currency", () => {
    const r = auditOceanInvoiceLine({
      ...baseParams,
      invoiceLine: {
        rawDescription: "THC",
        normalizedLabel: null,
        currency: "USD",
        amount: new Prisma.Decimal("100"),
        unitBasis: null,
        equipmentType: null,
        chargeStructureHint: null,
      },
      candidates: [
        charge({
          id: "c1",
          label: "THC",
          amount: 100,
          currency: "EUR",
        }),
      ],
    });
    expect(r.outcome).toBe("UNKNOWN");
    expect(r.discrepancyCategories).toContain(DISCREPANCY_CATEGORY.CURRENCY_MISMATCH);
  });

  it("matches a THC charge within tolerance (itemized)", () => {
    const r = auditOceanInvoiceLine({
      ...baseParams,
      invoiceLine: {
        rawDescription: "THC origin terminal",
        normalizedLabel: null,
        currency: "USD",
        amount: new Prisma.Decimal("185"),
        unitBasis: null,
        equipmentType: null,
        chargeStructureHint: "ITEMIZED",
      },
      candidates: [charge({ id: "c1", label: "THC origin terminal", amount: 185, currency: "USD" })],
    });
    expect(r.outcome).toBe("GREEN");
    expect(r.discrepancyCategories).toContain(DISCREPANCY_CATEGORY.AMOUNT_MATCH_WITHIN_TOLERANCE);
    expect(r.expectedAmount?.toString()).toBe("185");
  });

  it("maps cargo handling carrier wording to THC via built-in synonym appendix", () => {
    const r = auditOceanInvoiceLine({
      ...baseParams,
      invoiceLine: {
        rawDescription: "Cargo handling charge origin",
        normalizedLabel: null,
        currency: "USD",
        amount: new Prisma.Decimal("185"),
        unitBasis: null,
        equipmentType: null,
        chargeStructureHint: "ITEMIZED",
      },
      candidates: [
        charge({ id: "c1", label: "THC origin terminal", amount: 185, currency: "USD" }),
        charge({ id: "c2", label: "Documentation fee", amount: 75, currency: "USD" }),
      ],
    });
    expect(r.outcome).toBe("GREEN");
    expect(r.expectedAmount?.toString()).toBe("185");
  });

  it("favors snapshot line whose label equals normalizedLabel when raw description is vague", () => {
    const r = auditOceanInvoiceLine({
      ...baseParams,
      invoiceLine: {
        rawDescription: "Carrier statement line 2",
        normalizedLabel: "BAF surcharge",
        currency: "USD",
        amount: new Prisma.Decimal("150"),
        unitBasis: null,
        equipmentType: null,
        chargeStructureHint: "ITEMIZED",
      },
      candidates: [
        charge({ id: "c1", label: "BAF surcharge", amount: 150, currency: "USD" }),
        charge({
          id: "c2",
          label: "BAF bunker adjustment factor ocean carrier",
          amount: 150,
          currency: "USD",
        }),
      ],
    });
    expect(r.outcome).toBe("GREEN");
    expect(r.snapshotMatchedJson).toMatchObject({ id: "c1" });
  });

  it("maps VGM carrier wording toward VGM-style snapshot charges", () => {
    const r = auditOceanInvoiceLine({
      ...baseParams,
      invoiceLine: {
        rawDescription: "Verified gross mass administration",
        normalizedLabel: null,
        currency: "USD",
        amount: new Prisma.Decimal("50"),
        unitBasis: null,
        equipmentType: null,
        chargeStructureHint: "ITEMIZED",
      },
      candidates: [
        charge({ id: "c1", label: "VGM fee", amount: 50, currency: "USD" }),
        charge({ id: "c2", label: "Port security ISPS", amount: 50, currency: "USD" }),
      ],
    });
    expect(["GREEN", "AMBER"]).toContain(r.outcome);
    expect(r.snapshotMatchedJson).toMatchObject({ id: "c1" });
  });

  it("maps carrier wording Terminal handling to THC via synonyms plus charge aliases", () => {
    const r = auditOceanInvoiceLine({
      ...baseParams,
      aliases: [
        {
          pattern: "thc",
          canonicalTokens: ["thc", "terminal", "handling"],
          targetKind: "CONTRACT_CHARGE",
          priority: 23,
        },
      ],
      invoiceLine: {
        rawDescription: "Terminal handling charge origin",
        normalizedLabel: null,
        currency: "USD",
        amount: new Prisma.Decimal("185"),
        unitBasis: null,
        equipmentType: null,
        chargeStructureHint: "ITEMIZED",
      },
      candidates: [
        charge({ id: "c1", label: "THC origin terminal", amount: 185, currency: "USD" }),
        charge({ id: "c2", label: "Documentation fee", amount: 75, currency: "USD" }),
      ],
    });
    expect(r.outcome).toBe("GREEN");
    expect(r.expectedAmount?.toString()).toBe("185");
  });

  it("prefers RFQ line whose equipment matches invoice when descriptions are similar", () => {
    const rfqBase = {
      kind: "RFQ_LINE" as const,
      currency: "USD",
      raw: {},
      unitBasis: null,
      isIncluded: false,
      isMandatory: null as boolean | null,
      rateType: "FREIGHT" as string | null,
      originCode: null,
      destCode: null,
    };
    const r = auditOceanInvoiceLine({
      ...baseParams,
      snapshotSourceType: "QUOTE_RESPONSE",
      invoiceLine: {
        rawDescription: "Base ocean rate",
        normalizedLabel: null,
        currency: "USD",
        amount: new Prisma.Decimal("3200"),
        unitBasis: null,
        equipmentType: "40HC",
        chargeStructureHint: "ITEMIZED",
      },
      candidates: [
        { ...rfqBase, id: "l20", label: "Ocean FAK 20DV", amount: 1800, equipmentHint: "20DV" },
        { ...rfqBase, id: "l40", label: "Ocean FAK 40HC", amount: 3200, equipmentHint: "40HC" },
      ],
    });
    expect(r.outcome).toBe("GREEN");
    expect(r.snapshotMatchedJson).toMatchObject({ id: "l40" });
  });

  it("prefers RFQ line whose POL hint matches intake when labels and amounts are identical", () => {
    const rfqBase = {
      kind: "RFQ_LINE" as const,
      currency: "USD",
      raw: {},
      equipmentHint: null,
      unitBasis: null,
      isIncluded: false,
      isMandatory: null as boolean | null,
      rateType: "FREIGHT" as string | null,
    };
    const r = auditOceanInvoiceLine({
      ...baseParams,
      snapshotSourceType: "QUOTE_RESPONSE",
      intake: { polCode: "USNYC", podCode: null },
      invoiceLine: {
        rawDescription: "Freight all-in",
        normalizedLabel: null,
        currency: "USD",
        amount: new Prisma.Decimal("3200"),
        unitBasis: null,
        equipmentType: null,
        chargeStructureHint: "ITEMIZED",
      },
      candidates: [
        { ...rfqBase, id: "l-pol-miss", label: "Freight all-in", amount: 3200, originCode: null, destCode: null },
        { ...rfqBase, id: "l-pol-hit", label: "Freight all-in", amount: 3200, originCode: "USNYC", destCode: null },
      ],
    });
    expect(r.outcome).toBe("GREEN");
    expect(r.snapshotMatchedJson).toMatchObject({ id: "l-pol-hit" });
  });

  it("treats port-to-port freight wording as all-in for a single line", () => {
    const r = auditOceanInvoiceLine({
      ...baseParams,
      invoiceLineCount: 1,
      contractGrandTotal: 4200,
      invoiceLine: {
        rawDescription: "Port to port ocean freight lump sum",
        normalizedLabel: null,
        currency: "USD",
        amount: new Prisma.Decimal("4200"),
        unitBasis: null,
        equipmentType: null,
        chargeStructureHint: null,
      },
      candidates: [rate({ id: "r40", label: "FAK 40HC", amount: 3200, equipmentHint: "40HC", currency: "USD" })],
    });
    expect(r.outcome).toBe("GREEN");
    expect(r.snapshotMatchedJson).toMatchObject({ mode: "CONTRACT_BREAKDOWN_GRAND", expectedAmount: 4200 });
  });

  it("all-in single line without equipment uses contract snapshot grand (avoids summing every FCL rate)", () => {
    const r = auditOceanInvoiceLine({
      ...baseParams,
      invoiceLineCount: 1,
      contractGrandTotal: 5000,
      invoiceLine: {
        rawDescription: "All-in ocean freight lump sum",
        normalizedLabel: null,
        currency: "USD",
        amount: new Prisma.Decimal("5000"),
        unitBasis: null,
        equipmentType: null,
        chargeStructureHint: null,
      },
      candidates: [
        rate({ id: "r20", label: "FAK 20DV", amount: 1800, equipmentHint: "20DV", currency: "USD" }),
        rate({ id: "r40", label: "FAK 40HC", amount: 3200, equipmentHint: "40HC", currency: "USD" }),
      ],
    });
    expect(r.outcome).toBe("GREEN");
    expect(r.snapshotMatchedJson).toMatchObject({ mode: "CONTRACT_BREAKDOWN_GRAND", expectedAmount: 5000 });
  });
});
