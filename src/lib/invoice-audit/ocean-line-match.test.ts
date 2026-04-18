import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { DISCREPANCY_CATEGORY } from "@/lib/invoice-audit/discrepancy-categories";
import { auditOceanInvoiceLine } from "@/lib/invoice-audit/ocean-line-match";
import type { SnapshotPriceCandidate } from "@/lib/invoice-audit/snapshot-candidates";

const baseParams = {
  intake: { polCode: null, podCode: null },
  snapshotSourceType: "TARIFF_CONTRACT_VERSION",
  rfqGrandTotal: null as number | null,
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
});
