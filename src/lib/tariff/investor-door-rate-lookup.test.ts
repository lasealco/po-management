import { beforeEach, describe, expect, it, vi } from "vitest";

import { INVESTOR_DD_CONTRACT_NUMBERS, lookupInvestorDehamUschiDoorRates } from "./investor-door-rate-lookup";

const prismaMock = vi.hoisted(() => ({
  tariffContractHeader: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

function headerFixture(
  contractNumber: string,
  lines: {
    rateLines?: Array<{
      rateType: string;
      unitBasis: string;
      currency: string;
      amount: { toString(): string };
      originScope?: { name?: string; code?: string } | null;
      destinationScope?: { name?: string; code?: string } | null;
    }>;
    chargeLines?: Array<{
      rawChargeName: string;
      unitBasis: string;
      currency: string;
      amount: { toString(): string };
      normalizedChargeCode?: { code: string } | null;
    }>;
  },
) {
  const rateLines = lines.rateLines ?? [];
  const chargeLines = lines.chargeLines ?? [];
  const v = rateLines.length || chargeLines.length ? [{ rateLines, chargeLines }] : [];
  return {
    contractNumber,
    title: `Title ${contractNumber}`,
    provider: { legalName: "Carrier", tradingName: "C" },
    versions: v,
  };
}

describe("lookupInvestorDehamUschiDoorRates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orders options by INVESTOR_DD_CONTRACT_NUMBERS and skips headers without an approved version payload", async () => {
    const b = headerFixture(INVESTOR_DD_CONTRACT_NUMBERS[1], {
      rateLines: [
        {
          rateType: "BASE_RATE",
          unitBasis: "CTR",
          currency: "USD",
          amount: { toString: () => "100" },
          originScope: { name: "DEHAM" },
          destinationScope: { code: "USCHI" },
        },
      ],
    });
    const a = headerFixture(INVESTOR_DD_CONTRACT_NUMBERS[0], {
      chargeLines: [
        {
          rawChargeName: "DOCFEE",
          unitBasis: "BL",
          currency: "USD",
          amount: { toString: () => "25" },
          normalizedChargeCode: { code: "DOC" },
        },
      ],
    });
    prismaMock.tariffContractHeader.findMany.mockResolvedValue([b, a]);

    const res = await lookupInvestorDehamUschiDoorRates({ tenantId: "t1" });

    expect(res.lane).toBe("DEHAM → USCHI (door-to-door, FCL)");
    expect(res.equipment).toBe("40' HC");
    expect(res.options.map((o) => o.contractNumber)).toEqual([...INVESTOR_DD_CONTRACT_NUMBERS]);
    expect(res.options[0].totalUsd).toBe(25);
    expect(res.options[1].totalUsd).toBe(100);
    expect(res.options[0].lines[0].kind).toBe("CHARGE");
    expect(res.options[1].lines[0].label).toContain("BASE RATE");
    expect(prismaMock.tariffContractHeader.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "t1",
          contractNumber: { in: [...INVESTOR_DD_CONTRACT_NUMBERS] },
        },
      }),
    );
  });

  it("sums only USD lines for totalUsd", async () => {
    const h = headerFixture(INVESTOR_DD_CONTRACT_NUMBERS[0], {
      rateLines: [
        {
          rateType: "BASE_RATE",
          unitBasis: "CTR",
          currency: "EUR",
          amount: { toString: () => "50" },
          originScope: null,
          destinationScope: null,
        },
        {
          rateType: "SURCHARGE",
          unitBasis: "CTR",
          currency: "USD",
          amount: { toString: () => "10" },
          originScope: null,
          destinationScope: null,
        },
      ],
    });
    prismaMock.tariffContractHeader.findMany.mockResolvedValue([h]);
    const res = await lookupInvestorDehamUschiDoorRates({ tenantId: "t1" });
    expect(res.options[0].totalUsd).toBe(10);
  });
});
