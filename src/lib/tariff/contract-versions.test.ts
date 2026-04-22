import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTariffContractVersion,
  getTariffContractVersionForTenant,
  listTariffContractVersionsForHeader,
  requireMutableTariffContractVersionForTenant,
  requireTariffContractVersionForTenant,
  updateTariffContractVersion,
} from "./contract-versions";

const prismaMock = vi.hoisted(() => ({
  tariffContractVersion: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  tariffContractHeader: { findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const frozenVersionRow = {
  id: "v1",
  contractHeaderId: "h1",
  versionNo: 1,
  sourceType: "EXCEL",
  sourceReference: null,
  sourceFileUrl: null,
  approvalStatus: "APPROVED",
  status: "APPROVED",
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

const mutableVersionRow = {
  ...frozenVersionRow,
  approvalStatus: "PENDING",
  status: "DRAFT",
};

describe("getTariffContractVersionForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when version is not in tenant scope", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(null);
    const r = await getTariffContractVersionForTenant({ tenantId: "t1", versionId: "v1" });
    expect(r).toBeNull();
    expect(prismaMock.tariffContractVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "v1", contractHeader: { tenantId: "t1" } },
      }),
    );
  });
});

describe("requireTariffContractVersionForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when version is missing", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(null);
    await expect(requireTariffContractVersionForTenant({ tenantId: "t1", versionId: "v1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("requireMutableTariffContractVersionForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws VERSION_FROZEN when approval and contract status are both APPROVED", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(frozenVersionRow);
    await expect(
      requireMutableTariffContractVersionForTenant({ tenantId: "t1", versionId: "v1" }),
    ).rejects.toMatchObject({ code: "VERSION_FROZEN" });
  });
});

describe("listTariffContractVersionsForHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when header is missing for tenant", async () => {
    prismaMock.tariffContractHeader.findFirst.mockResolvedValue(null);
    await expect(
      listTariffContractVersionsForHeader({ tenantId: "t1", contractHeaderId: "h-missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffContractVersion.findMany).not.toHaveBeenCalled();
  });

  it("lists versions ordered by versionNo desc when header exists", async () => {
    prismaMock.tariffContractHeader.findFirst.mockResolvedValue({ id: "h1" });
    prismaMock.tariffContractVersion.findMany.mockResolvedValue([]);
    await listTariffContractVersionsForHeader({ tenantId: "t1", contractHeaderId: "h1" });
    expect(prismaMock.tariffContractVersion.findMany).toHaveBeenCalledWith({
      where: { contractHeaderId: "h1" },
      orderBy: { versionNo: "desc" },
    });
  });
});

describe("createTariffContractVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffContractHeader.findFirst.mockResolvedValue({ id: "h1" });
    prismaMock.tariffContractVersion.aggregate.mockResolvedValue({ _max: { versionNo: 4 } });
    prismaMock.tariffContractVersion.create.mockResolvedValue({ id: "v-new" });
  });

  it("throws NOT_FOUND when header is missing", async () => {
    prismaMock.tariffContractHeader.findFirst.mockResolvedValue(null);
    await expect(
      createTariffContractVersion({ tenantId: "t1", contractHeaderId: "gone", sourceType: "EXCEL" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffContractVersion.create).not.toHaveBeenCalled();
  });

  it("increments versionNo and trims optional strings", async () => {
    await createTariffContractVersion({
      tenantId: "t1",
      contractHeaderId: "h1",
      sourceType: "EXCEL",
      sourceReference: "  ref  ",
      sourceFileUrl: "  https://f  ",
      comments: "  note  ",
    });
    expect(prismaMock.tariffContractVersion.aggregate).toHaveBeenCalledWith({
      where: { contractHeaderId: "h1" },
      _max: { versionNo: true },
    });
    expect(prismaMock.tariffContractVersion.create).toHaveBeenCalledWith({
      data: {
        contractHeaderId: "h1",
        versionNo: 5,
        sourceType: "EXCEL",
        sourceReference: "ref",
        sourceFileUrl: "https://f",
        approvalStatus: "PENDING",
        status: "DRAFT",
        validFrom: null,
        validTo: null,
        bookingDateValidFrom: null,
        bookingDateValidTo: null,
        sailingDateValidFrom: null,
        sailingDateValidTo: null,
        comments: "note",
      },
    });
  });
});

describe("updateTariffContractVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when version is missing", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(null);
    await expect(
      updateTariffContractVersion({ tenantId: "t1", versionId: "gone" }, { comments: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffContractVersion.update).not.toHaveBeenCalled();
  });

  it("throws VERSION_FROZEN when version is fully approved", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(frozenVersionRow);
    await expect(
      updateTariffContractVersion({ tenantId: "t1", versionId: "v1" }, { comments: "x" }),
    ).rejects.toMatchObject({ code: "VERSION_FROZEN" });
    expect(prismaMock.tariffContractVersion.update).not.toHaveBeenCalled();
  });

  it("trims string patches and forwards allowed fields", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(mutableVersionRow);
    prismaMock.tariffContractVersion.update.mockResolvedValue({ id: "v1" });
    await updateTariffContractVersion(
      { tenantId: "t1", versionId: "v1" },
      {
        sourceReference: "  r  ",
        sourceFileUrl: "  u  ",
        comments: "  c  ",
        status: "UNDER_REVIEW",
      },
    );
    expect(prismaMock.tariffContractVersion.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: {
        sourceReference: "r",
        sourceFileUrl: "u",
        status: "UNDER_REVIEW",
        comments: "c",
      },
    });
  });
});
