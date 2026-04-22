import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTariffRateLine,
  deleteTariffRateLine,
  getTariffRateLineForTenant,
  listTariffRateLinesForTenantVersion,
  updateTariffRateLine,
} from "./rate-lines";

const prismaMock = vi.hoisted(() => ({
  tariffContractVersion: { findFirst: vi.fn() },
  tariffRateLine: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const mutableVersionGuardRow = {
  id: "v1",
  contractHeaderId: "h1",
  versionNo: 1,
  sourceType: "EXCEL" as const,
  sourceReference: null,
  sourceFileUrl: null,
  approvalStatus: "PENDING" as const,
  status: "DRAFT" as const,
  validFrom: null,
  validTo: null,
  bookingDateValidFrom: null,
  bookingDateValidTo: null,
  sailingDateValidFrom: null,
  sailingDateValidTo: null,
  comments: null,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
};

const frozenVersionGuardRow = {
  ...mutableVersionGuardRow,
  approvalStatus: "APPROVED" as const,
  status: "APPROVED" as const,
};

describe("getTariffRateLineForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when rate line is not in tenant scope", async () => {
    prismaMock.tariffRateLine.findFirst.mockResolvedValue(null);
    await expect(getTariffRateLineForTenant({ tenantId: "t1", id: "rl-missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("listTariffRateLinesForTenantVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when contract version is not in tenant scope", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(null);
    await expect(
      listTariffRateLinesForTenantVersion({ tenantId: "t1", contractVersionId: "v1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffRateLine.findMany).not.toHaveBeenCalled();
  });

  it("lists rate lines ordered by id asc when version exists", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue({ id: "v1" });
    prismaMock.tariffRateLine.findMany.mockResolvedValue([]);
    await listTariffRateLinesForTenantVersion({ tenantId: "t1", contractVersionId: "v1" });
    expect(prismaMock.tariffRateLine.findMany).toHaveBeenCalledWith({
      where: { contractVersionId: "v1" },
      orderBy: { id: "asc" },
    });
  });
});

describe("createTariffRateLine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(mutableVersionGuardRow);
    prismaMock.tariffRateLine.create.mockResolvedValue({ id: "rl-new" });
  });

  it("throws VERSION_FROZEN when contract version is fully approved", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(frozenVersionGuardRow);
    await expect(
      createTariffRateLine({
        tenantId: "t1",
        contractVersionId: "v1",
        rateType: "BASE_RATE",
        unitBasis: "CONTAINER",
        currency: "usd",
        amount: 100,
      }),
    ).rejects.toMatchObject({ code: "VERSION_FROZEN" });
    expect(prismaMock.tariffRateLine.create).not.toHaveBeenCalled();
  });

  it("trims strings, uppercases currency to 3 chars, and creates row", async () => {
    await createTariffRateLine({
      tenantId: "t1",
      contractVersionId: "v1",
      rateType: "BASE_RATE",
      unitBasis: "  per ctr  ",
      currency: "  eur  ",
      amount: 12.5,
      equipmentType: "  40HC  ",
      notes: "  n  ",
    });
    expect(prismaMock.tariffRateLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contractVersionId: "v1",
        rateType: "BASE_RATE",
        unitBasis: "per ctr",
        currency: "EUR",
        equipmentType: "40HC",
        notes: "n",
      }),
    });
    const call = prismaMock.tariffRateLine.create.mock.calls[0][0];
    expect(String(call.data.amount)).toBe("12.5");
  });
});

describe("updateTariffRateLine", () => {
  const lineRow = {
    id: "rl1",
    contractVersionId: "v1",
    contractVersion: { id: "v1", approvalStatus: "PENDING" as const, status: "DRAFT" as const },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffRateLine.findFirst.mockResolvedValue(lineRow);
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(mutableVersionGuardRow);
    prismaMock.tariffRateLine.update.mockResolvedValue({ id: "rl1" });
  });

  it("throws VERSION_FROZEN when version no longer allows line mutations", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(frozenVersionGuardRow);
    await expect(updateTariffRateLine({ tenantId: "t1", id: "rl1" }, { notes: "x" })).rejects.toMatchObject({
      code: "VERSION_FROZEN",
    });
    expect(prismaMock.tariffRateLine.update).not.toHaveBeenCalled();
  });

  it("trims notes on patch", async () => {
    await updateTariffRateLine({ tenantId: "t1", id: "rl1" }, { notes: "  patched  " });
    expect(prismaMock.tariffRateLine.update).toHaveBeenCalledWith({
      where: { id: "rl1" },
      data: { notes: "patched" },
    });
  });
});

describe("deleteTariffRateLine", () => {
  const lineRow = {
    id: "rl1",
    contractVersionId: "v1",
    contractVersion: { id: "v1", approvalStatus: "PENDING" as const, status: "DRAFT" as const },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffRateLine.findFirst.mockResolvedValue(lineRow);
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(mutableVersionGuardRow);
    prismaMock.tariffRateLine.delete.mockResolvedValue(lineRow);
  });

  it("deletes after mutation guard passes", async () => {
    await deleteTariffRateLine({ tenantId: "t1", id: "rl1" });
    expect(prismaMock.tariffRateLine.delete).toHaveBeenCalledWith({ where: { id: "rl1" } });
  });
});
