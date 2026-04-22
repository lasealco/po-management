import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTariffFreeTimeRule,
  deleteTariffFreeTimeRule,
  getTariffFreeTimeRuleForTenant,
  listTariffFreeTimeRulesForTenantVersion,
  updateTariffFreeTimeRule,
} from "./free-time-rules";

const prismaMock = vi.hoisted(() => ({
  tariffContractVersion: { findFirst: vi.fn() },
  tariffFreeTimeRule: {
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

describe("getTariffFreeTimeRuleForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when rule is not in tenant scope", async () => {
    prismaMock.tariffFreeTimeRule.findFirst.mockResolvedValue(null);
    await expect(getTariffFreeTimeRuleForTenant({ tenantId: "t1", id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("listTariffFreeTimeRulesForTenantVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when contract version is not in tenant scope", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(null);
    await expect(
      listTariffFreeTimeRulesForTenantVersion({ tenantId: "t1", contractVersionId: "v1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffFreeTimeRule.findMany).not.toHaveBeenCalled();
  });

  it("lists rules ordered by id asc when version exists", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue({ id: "v1" });
    prismaMock.tariffFreeTimeRule.findMany.mockResolvedValue([]);
    await listTariffFreeTimeRulesForTenantVersion({ tenantId: "t1", contractVersionId: "v1" });
    expect(prismaMock.tariffFreeTimeRule.findMany).toHaveBeenCalledWith({
      where: { contractVersionId: "v1" },
      orderBy: { id: "asc" },
    });
  });
});

describe("createTariffFreeTimeRule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(mutableVersionGuardRow);
    prismaMock.tariffFreeTimeRule.create.mockResolvedValue({ id: "ftr-new" });
  });

  it("throws VERSION_FROZEN when contract version is fully approved", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(frozenVersionGuardRow);
    await expect(
      createTariffFreeTimeRule({
        tenantId: "t1",
        contractVersionId: "v1",
        ruleType: "DETENTION",
        freeDays: 3,
      }),
    ).rejects.toMatchObject({ code: "VERSION_FROZEN" });
    expect(prismaMock.tariffFreeTimeRule.create).not.toHaveBeenCalled();
  });

  it("throws CONFLICT when freeDays is invalid", async () => {
    await expect(
      createTariffFreeTimeRule({
        tenantId: "t1",
        contractVersionId: "v1",
        ruleType: "DETENTION",
        freeDays: -1,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      createTariffFreeTimeRule({
        tenantId: "t1",
        contractVersionId: "v1",
        ruleType: "DETENTION",
        freeDays: Number.NaN,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prismaMock.tariffFreeTimeRule.create).not.toHaveBeenCalled();
  });

  it("floors freeDays and trims optional strings", async () => {
    await createTariffFreeTimeRule({
      tenantId: "t1",
      contractVersionId: "v1",
      ruleType: "DEMURRAGE",
      freeDays: 4.7,
      importExportScope: "  exp  ",
      equipmentScope: "  40HC  ",
      notes: "  n  ",
    });
    expect(prismaMock.tariffFreeTimeRule.create).toHaveBeenCalledWith({
      data: {
        contractVersionId: "v1",
        geographyScopeId: null,
        importExportScope: "exp",
        equipmentScope: "40HC",
        ruleType: "DEMURRAGE",
        freeDays: 4,
        validFrom: null,
        validTo: null,
        notes: "n",
      },
    });
  });
});

describe("updateTariffFreeTimeRule", () => {
  const row = {
    id: "ftr1",
    contractVersionId: "v1",
    contractVersion: { id: "v1", approvalStatus: "PENDING" as const, status: "DRAFT" as const },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffFreeTimeRule.findFirst.mockResolvedValue(row);
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(mutableVersionGuardRow);
    prismaMock.tariffFreeTimeRule.update.mockResolvedValue({ id: "ftr1" });
  });

  it("throws VERSION_FROZEN when version no longer allows mutations", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(frozenVersionGuardRow);
    await expect(updateTariffFreeTimeRule({ tenantId: "t1", id: "ftr1" }, { notes: "x" })).rejects.toMatchObject({
      code: "VERSION_FROZEN",
    });
    expect(prismaMock.tariffFreeTimeRule.update).not.toHaveBeenCalled();
  });

  it("throws CONFLICT when patching invalid freeDays", async () => {
    await expect(updateTariffFreeTimeRule({ tenantId: "t1", id: "ftr1" }, { freeDays: -2 })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(prismaMock.tariffFreeTimeRule.update).not.toHaveBeenCalled();
  });

  it("floors freeDays and trims notes on patch", async () => {
    await updateTariffFreeTimeRule({ tenantId: "t1", id: "ftr1" }, { freeDays: 9.1, notes: "  hi  " });
    expect(prismaMock.tariffFreeTimeRule.update).toHaveBeenCalledWith({
      where: { id: "ftr1" },
      data: { freeDays: 9, notes: "hi" },
    });
  });
});

describe("deleteTariffFreeTimeRule", () => {
  const row = {
    id: "ftr1",
    contractVersionId: "v1",
    contractVersion: { id: "v1", approvalStatus: "PENDING" as const, status: "DRAFT" as const },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffFreeTimeRule.findFirst.mockResolvedValue(row);
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(mutableVersionGuardRow);
    prismaMock.tariffFreeTimeRule.delete.mockResolvedValue(row);
  });

  it("deletes after mutation guard passes", async () => {
    await deleteTariffFreeTimeRule({ tenantId: "t1", id: "ftr1" });
    expect(prismaMock.tariffFreeTimeRule.delete).toHaveBeenCalledWith({ where: { id: "ftr1" } });
  });
});
