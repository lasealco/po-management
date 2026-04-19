import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getVersionMock } = vi.hoisted(() => ({
  prismaMock: { quoteResponse: { findFirst: vi.fn() } },
  getVersionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/tariff/contract-versions", () => ({
  getTariffContractVersionForTenant: getVersionMock,
}));

import { resolvePricingSnapshotSourceNav } from "@/lib/invoice-audit/pricing-snapshot-source-nav";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolvePricingSnapshotSourceNav", () => {
  it("returns tariff version URL when contract version exists", async () => {
    getVersionMock.mockResolvedValue({ id: "ver1", contractHeaderId: "hdr1" } as never);
    await expect(
      resolvePricingSnapshotSourceNav({
        tenantId: "t1",
        sourceType: "TARIFF_CONTRACT_VERSION",
        sourceRecordId: "ver1",
      }),
    ).resolves.toEqual({
      tariffVersionHref: "/tariffs/contracts/hdr1/versions/ver1",
      rfqRequestHref: null,
    });
  });

  it("returns null tariff href when version is missing", async () => {
    getVersionMock.mockResolvedValue(null);
    await expect(
      resolvePricingSnapshotSourceNav({
        tenantId: "t1",
        sourceType: "TARIFF_CONTRACT_VERSION",
        sourceRecordId: "gone",
      }),
    ).resolves.toEqual({ tariffVersionHref: null, rfqRequestHref: null });
  });

  it("returns RFQ request URL when quote response exists", async () => {
    vi.mocked(prismaMock.quoteResponse.findFirst).mockResolvedValue({ quoteRequestId: "req9" } as never);
    await expect(
      resolvePricingSnapshotSourceNav({
        tenantId: "t1",
        sourceType: "QUOTE_RESPONSE",
        sourceRecordId: "resp1",
      }),
    ).resolves.toEqual({
      tariffVersionHref: null,
      rfqRequestHref: "/rfq/requests/req9",
    });
    expect(prismaMock.quoteResponse.findFirst).toHaveBeenCalledWith({
      where: { id: "resp1", quoteRequest: { tenantId: "t1" } },
      select: { quoteRequestId: true },
    });
  });

  it("returns no links for blank source record id", async () => {
    await expect(
      resolvePricingSnapshotSourceNav({
        tenantId: "t1",
        sourceType: "TARIFF_CONTRACT_VERSION",
        sourceRecordId: "   ",
      }),
    ).resolves.toEqual({ tariffVersionHref: null, rfqRequestHref: null });
    expect(getVersionMock).not.toHaveBeenCalled();
  });
});
