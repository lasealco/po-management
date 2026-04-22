import { beforeEach, describe, expect, it, vi } from "vitest";

import { rateTariffLane } from "./rating-engine";

const prismaMock = vi.hoisted(() => ({
  tariffContractHeader: { findMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

function baseRateLine(id: string, pol: string, pod: string) {
  return {
    id,
    rateType: "BASE_RATE" as const,
    equipmentType: "40HC",
    currency: "USD",
    amount: { toString: () => "1000" },
    serviceScope: "FCL",
    rawRateDescription: null as string | null,
    originScope: { members: [{ memberCode: pol }] },
    destinationScope: { members: [{ memberCode: pod }] },
  };
}

function approvedVersion(overrides: {
  id?: string;
  validFrom?: Date | null;
  validTo?: Date | null;
  rateLines?: ReturnType<typeof baseRateLine>[];
  chargeLines?: Array<{
    id: string;
    rawChargeName: string;
    currency: string;
    amount: { toString(): string };
    equipmentScope: string | null;
    isIncluded: boolean;
    normalizedChargeCode: { code: string } | null;
    geographyScope: { members: { memberCode: string }[] } | null;
  }>;
}) {
  return {
    id: overrides.id ?? "v1",
    versionNo: 1,
    validFrom: overrides.validFrom ?? null,
    validTo: overrides.validTo ?? null,
    rateLines: overrides.rateLines ?? [baseRateLine("rl1", "DEHAM", "USCHI")],
    chargeLines: overrides.chargeLines ?? [],
  };
}

function headerFixture(
  id: string,
  version: ReturnType<typeof approvedVersion>,
  providerId = "p1",
) {
  return {
    id,
    contractNumber: `CN-${id}`,
    title: `Title ${id}`,
    providerId,
    transportMode: "OCEAN" as const,
    status: "APPROVED" as const,
    provider: { id: providerId, legalName: `Legal ${providerId}`, tradingName: null as string | null },
    versions: [version],
  };
}

describe("rateTariffLane", () => {
  const asOf = new Date(Date.UTC(2024, 5, 15));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty candidates when no headers match", async () => {
    prismaMock.tariffContractHeader.findMany.mockResolvedValue([]);
    const res = await rateTariffLane({
      tenantId: "t1",
      pol: "DEHAM",
      pod: "USCHI",
      equipment: "40HC",
      asOf,
      transportMode: "OCEAN",
    });
    expect(res.candidates).toEqual([]);
    expect(res.meta).toMatchObject({
      pol: "DEHAM",
      pod: "USCHI",
      equipment: "40HC",
      transportMode: "OCEAN",
    });
  });

  it("passes providerIds into Prisma where when set", async () => {
    prismaMock.tariffContractHeader.findMany.mockResolvedValue([]);
    await rateTariffLane({
      tenantId: "t1",
      pol: "DEHAM",
      pod: "USCHI",
      equipment: "40HC",
      asOf,
      transportMode: "OCEAN",
      providerIds: ["a", "b"],
    });
    expect(prismaMock.tariffContractHeader.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "t1",
          transportMode: "OCEAN",
          status: "APPROVED",
          providerId: { in: ["a", "b"] },
        }),
      }),
    );
  });

  it("skips versions outside validFrom/validTo for asOf (UTC date only)", async () => {
    const expired = approvedVersion({
      validTo: new Date(Date.UTC(2024, 5, 1)),
    });
    prismaMock.tariffContractHeader.findMany.mockResolvedValue([headerFixture("h1", expired)]);
    const res = await rateTariffLane({
      tenantId: "t1",
      pol: "DEHAM",
      pod: "USCHI",
      equipment: "40HC",
      asOf,
      transportMode: "OCEAN",
    });
    expect(res.candidates).toHaveLength(0);
  });

  it("sums payable BASE_RATE and non-included charges into totalsByCurrency", async () => {
    const v = approvedVersion({
      chargeLines: [
        {
          id: "c1",
          rawChargeName: "DOC",
          currency: "USD",
          amount: { toString: () => "50" },
          equipmentScope: null,
          isIncluded: false,
          normalizedChargeCode: { code: "DOC" },
          geographyScope: null,
        },
      ],
    });
    prismaMock.tariffContractHeader.findMany.mockResolvedValue([headerFixture("h1", v)]);
    const res = await rateTariffLane({
      tenantId: "t1",
      pol: "DEHAM",
      pod: "USCHI",
      equipment: "40HC",
      asOf,
      transportMode: "OCEAN",
    });
    expect(res.candidates).toHaveLength(1);
    const c0 = res.candidates[0];
    expect(c0.totalsByCurrency.USD).toBe(1050);
    expect(c0.lines.some((l) => l.kind === "RATE")).toBe(true);
    expect(c0.lines.some((l) => l.kind === "CHARGE" && l.payable)).toBe(true);
  });

  it("caps maxResults at 50 and floors below 1 via clamped take", async () => {
    const headers = Array.from({ length: 3 }, (_, i) =>
      headerFixture(`h${i}`, approvedVersion({ id: `v${i}` }), `p${i}`),
    );
    prismaMock.tariffContractHeader.findMany.mockResolvedValue(headers);
    const hi = await rateTariffLane({
      tenantId: "t1",
      pol: "DEHAM",
      pod: "USCHI",
      equipment: "40HC",
      asOf,
      transportMode: "OCEAN",
      maxResults: 999,
    });
    expect(hi.candidates).toHaveLength(3);
    const lo = await rateTariffLane({
      tenantId: "t1",
      pol: "DEHAM",
      pod: "USCHI",
      equipment: "40HC",
      asOf,
      transportMode: "OCEAN",
      maxResults: 2,
    });
    expect(lo.candidates).toHaveLength(2);
    const one = await rateTariffLane({
      tenantId: "t1",
      pol: "DEHAM",
      pod: "USCHI",
      equipment: "40HC",
      asOf,
      transportMode: "OCEAN",
      maxResults: 0,
    });
    expect(one.candidates).toHaveLength(1);
  });

  it("omits non-payable informational charges from totals", async () => {
    const v = approvedVersion({
      rateLines: [],
      chargeLines: [
        {
          id: "c1",
          rawChargeName: "INFO",
          currency: "USD",
          amount: { toString: () => "99" },
          equipmentScope: null,
          isIncluded: true,
          normalizedChargeCode: null,
          geographyScope: null,
        },
      ],
    });
    prismaMock.tariffContractHeader.findMany.mockResolvedValue([headerFixture("h1", v)]);
    const res = await rateTariffLane({
      tenantId: "t1",
      pol: "DEHAM",
      pod: "USCHI",
      equipment: "40' HC",
      asOf,
      transportMode: "OCEAN",
    });
    expect(res.candidates[0].lines.some((l) => l.payable === false)).toBe(true);
    expect(res.candidates[0].totalsByCurrency.USD ?? 0).toBe(0);
  });
});
