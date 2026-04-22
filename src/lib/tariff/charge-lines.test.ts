import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTariffChargeLine,
  deleteTariffChargeLine,
  getTariffChargeLineForTenant,
  listTariffChargeLinesForTenantVersion,
  updateTariffChargeLine,
} from "./charge-lines";

const prismaMock = vi.hoisted(() => ({
  tariffContractVersion: { findFirst: vi.fn() },
  tariffChargeLine: {
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

describe("getTariffChargeLineForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when charge line is not in tenant scope", async () => {
    prismaMock.tariffChargeLine.findFirst.mockResolvedValue(null);
    await expect(getTariffChargeLineForTenant({ tenantId: "t1", id: "cl-missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("listTariffChargeLinesForTenantVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when contract version is not in tenant scope", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(null);
    await expect(
      listTariffChargeLinesForTenantVersion({ tenantId: "t1", contractVersionId: "v1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffChargeLine.findMany).not.toHaveBeenCalled();
  });

  it("lists charge lines with normalized code include when version exists", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue({ id: "v1" });
    prismaMock.tariffChargeLine.findMany.mockResolvedValue([]);
    await listTariffChargeLinesForTenantVersion({ tenantId: "t1", contractVersionId: "v1" });
    expect(prismaMock.tariffChargeLine.findMany).toHaveBeenCalledWith({
      where: { contractVersionId: "v1" },
      orderBy: { id: "asc" },
      include: {
        normalizedChargeCode: { select: { id: true, code: true, displayName: true } },
      },
    });
  });
});

describe("createTariffChargeLine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(mutableVersionGuardRow);
    prismaMock.tariffChargeLine.create.mockResolvedValue({ id: "cl-new" });
  });

  it("throws VERSION_FROZEN when contract version is fully approved", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(frozenVersionGuardRow);
    await expect(
      createTariffChargeLine({
        tenantId: "t1",
        contractVersionId: "v1",
        rawChargeName: "DOC",
        unitBasis: "BL",
        currency: "usd",
        amount: 50,
      }),
    ).rejects.toMatchObject({ code: "VERSION_FROZEN" });
    expect(prismaMock.tariffChargeLine.create).not.toHaveBeenCalled();
  });

  it("trims strings, uppercases currency, and defaults flags", async () => {
    await createTariffChargeLine({
      tenantId: "t1",
      contractVersionId: "v1",
      rawChargeName: "  THC  ",
      unitBasis: "  ctr  ",
      currency: "  usd  ",
      amount: 10,
      directionScope: "  exp  ",
    });
    expect(prismaMock.tariffChargeLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contractVersionId: "v1",
        rawChargeName: "THC",
        unitBasis: "ctr",
        currency: "USD",
        directionScope: "exp",
        isIncluded: false,
        isMandatory: true,
      }),
    });
  });
});

describe("updateTariffChargeLine", () => {
  const lineRow = {
    id: "cl1",
    contractVersionId: "v1",
    contractVersion: { id: "v1", approvalStatus: "PENDING" as const, status: "DRAFT" as const },
    normalizedChargeCode: null as null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffChargeLine.findFirst.mockResolvedValue(lineRow);
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(mutableVersionGuardRow);
    prismaMock.tariffChargeLine.update.mockResolvedValue({ id: "cl1" });
  });

  it("throws VERSION_FROZEN when version no longer allows line mutations", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(frozenVersionGuardRow);
    await expect(updateTariffChargeLine({ tenantId: "t1", id: "cl1" }, { notes: "x" })).rejects.toMatchObject({
      code: "VERSION_FROZEN",
    });
    expect(prismaMock.tariffChargeLine.update).not.toHaveBeenCalled();
  });

  it("trims rawChargeName on patch", async () => {
    await updateTariffChargeLine({ tenantId: "t1", id: "cl1" }, { rawChargeName: "  NEW  " });
    expect(prismaMock.tariffChargeLine.update).toHaveBeenCalledWith({
      where: { id: "cl1" },
      data: { rawChargeName: "NEW" },
    });
  });
});

describe("deleteTariffChargeLine", () => {
  const lineRow = {
    id: "cl1",
    contractVersionId: "v1",
    contractVersion: { id: "v1", approvalStatus: "PENDING" as const, status: "DRAFT" as const },
    normalizedChargeCode: null as null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffChargeLine.findFirst.mockResolvedValue(lineRow);
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(mutableVersionGuardRow);
    prismaMock.tariffChargeLine.delete.mockResolvedValue(lineRow);
  });

  it("deletes after mutation guard passes", async () => {
    await deleteTariffChargeLine({ tenantId: "t1", id: "cl1" });
    expect(prismaMock.tariffChargeLine.delete).toHaveBeenCalledWith({ where: { id: "cl1" } });
  });
});
