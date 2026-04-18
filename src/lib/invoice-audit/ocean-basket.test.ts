import { describe, expect, it } from "vitest";

import { buildContractOceanBasket, rfqAllInReferenceTotal } from "@/lib/invoice-audit/ocean-basket";
import type { SnapshotPriceCandidate } from "@/lib/invoice-audit/snapshot-candidates";

const baseRate = (over: Partial<SnapshotPriceCandidate> & Pick<SnapshotPriceCandidate, "id" | "label" | "amount">): SnapshotPriceCandidate => ({
  kind: "CONTRACT_RATE",
  currency: "USD",
  raw: {},
  unitBasis: null,
  originCode: null,
  destCode: null,
  isIncluded: null,
  isMandatory: null,
  rateType: "FAK",
  equipmentHint: null,
  ...over,
});

const baseCharge = (over: Partial<SnapshotPriceCandidate> & Pick<SnapshotPriceCandidate, "id" | "label" | "amount">): SnapshotPriceCandidate => ({
  kind: "CONTRACT_CHARGE",
  currency: "USD",
  raw: {},
  unitBasis: null,
  originCode: null,
  destCode: null,
  isIncluded: false,
  isMandatory: true,
  rateType: null,
  equipmentHint: null,
  ...over,
});

const rfqLine = (over: Partial<SnapshotPriceCandidate> & Pick<SnapshotPriceCandidate, "id" | "label" | "amount">): SnapshotPriceCandidate => ({
  kind: "RFQ_LINE",
  currency: "USD",
  raw: {},
  equipmentHint: null,
  unitBasis: null,
  originCode: null,
  destCode: null,
  isIncluded: false,
  isMandatory: null,
  rateType: "FREIGHT",
  ...over,
});

describe("buildContractOceanBasket", () => {
  it("sums rate for matching equipment and mandatory BAF-style charge", () => {
    const { total, components } = buildContractOceanBasket({
      equipmentKey: "40HC",
      candidates: [
        baseRate({ id: "r1", label: "FAK 40HC", amount: 2000, equipmentHint: "40HC" }),
        baseRate({ id: "r2", label: "FAK 20DV", amount: 900, equipmentHint: "20DV" }),
        baseCharge({ id: "c1", label: "BAF surcharge", amount: 150, equipmentHint: null }),
        baseCharge({ id: "c2", label: "Included bundle", amount: 50, isIncluded: true, isMandatory: true }),
      ],
    });
    expect(total).toBe(2150);
    expect(components.map((c) => c.kind).sort()).toEqual(["CONTRACT_CHARGE", "CONTRACT_RATE"]);
  });

  it("includes inland haul style mandatory charges in the basket", () => {
    const { total, components } = buildContractOceanBasket({
      equipmentKey: "40HC",
      candidates: [
        baseRate({ id: "r1", label: "FAK 40HC", amount: 2000, equipmentHint: "40HC" }),
        baseCharge({ id: "c1", label: "IHC inland haulage", amount: 120, equipmentHint: null }),
      ],
    });
    expect(total).toBe(2120);
    expect(components.some((c) => c.label.includes("IHC"))).toBe(true);
  });

  it("skips ancillary charges that do not match equipment scope", () => {
    const { total } = buildContractOceanBasket({
      equipmentKey: "40HC",
      candidates: [
        baseRate({ id: "r1", label: "FAK 40HC", amount: 2000, equipmentHint: "40HC" }),
        baseCharge({ id: "c1", label: "THC 20DV", amount: 100, equipmentHint: "20DV" }),
      ],
    });
    expect(total).toBe(2000);
  });
});

describe("rfqAllInReferenceTotal", () => {
  it("prefers breakdown grand when present", () => {
    const { total, components } = rfqAllInReferenceTotal({
      breakdownGrand: 999,
      candidates: [rfqLine({ id: "l1", label: "Line", amount: 1, currency: "USD" })],
    });
    expect(total).toBe(999);
    expect(components).toHaveLength(1);
    expect(components[0]!.kind).toBe("RFQ_GRAND");
  });

  it("sums RFQ lines when grand is absent", () => {
    const { total } = rfqAllInReferenceTotal({
      breakdownGrand: null,
      candidates: [
        rfqLine({ id: "a", label: "A", amount: 100, currency: "USD" }),
        rfqLine({ id: "b", label: "B", amount: 50, currency: "USD" }),
      ],
    });
    expect(total).toBe(150);
  });
});
