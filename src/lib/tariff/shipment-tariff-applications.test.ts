import { beforeEach, describe, expect, it, vi } from "vitest";

import { attachTariffVersionToShipment, listTariffShipmentApplications } from "./shipment-tariff-applications";

const txMock = vi.hoisted(() => ({
  tariffShipmentApplication: {
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
}));

const prismaMock = vi.hoisted(() => ({
  tariffShipmentApplication: { findMany: vi.fn() },
  shipment: { findFirst: vi.fn() },
  tariffContractVersion: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("listTariffShipmentApplications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffShipmentApplication.findMany.mockResolvedValue([]);
  });

  it("scopes by tenant and shipment and orders primary first", async () => {
    await listTariffShipmentApplications({ tenantId: "t1", shipmentId: "s1" });
    expect(prismaMock.tariffShipmentApplication.findMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", shipmentId: "s1" },
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
      include: {
        contractVersion: {
          select: {
            id: true,
            versionNo: true,
            validFrom: true,
            validTo: true,
            contractHeader: {
              select: {
                id: true,
                contractNumber: true,
                title: true,
                transportMode: true,
                provider: { select: { id: true, legalName: true, tradingName: true } },
              },
            },
          },
        },
      },
    });
  });
});

describe("attachTariffVersionToShipment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.shipment.findFirst.mockResolvedValue({ id: "s1" });
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue({ id: "v1" });
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock));
    txMock.tariffShipmentApplication.updateMany.mockResolvedValue({ count: 0 });
    txMock.tariffShipmentApplication.upsert.mockResolvedValue({ id: "app1" });
  });

  it("throws NOT_FOUND when shipment is not in tenant scope", async () => {
    prismaMock.shipment.findFirst.mockResolvedValue(null);
    await expect(
      attachTariffVersionToShipment({
        tenantId: "t1",
        shipmentId: "gone",
        contractVersionId: "v1",
        createdById: "u1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when contract version is not in tenant scope", async () => {
    prismaMock.tariffContractVersion.findFirst.mockResolvedValue(null);
    await expect(
      attachTariffVersionToShipment({
        tenantId: "t1",
        shipmentId: "s1",
        contractVersionId: "gone",
        createdById: "u1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("clears other primaries and upserts when isPrimary is true", async () => {
    await attachTariffVersionToShipment({
      tenantId: "t1",
      shipmentId: "s1",
      contractVersionId: "v1",
      isPrimary: true,
      source: "  API  ",
      polCode: "  deham  ",
      podCode: "  uschi  ",
      equipmentType: "  40HC  ",
      appliedNotes: "  note  ",
      createdById: "u1",
    });
    expect(txMock.tariffShipmentApplication.updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", shipmentId: "s1", isPrimary: true },
      data: { isPrimary: false },
    });
    expect(txMock.tariffShipmentApplication.upsert).toHaveBeenCalledWith({
      where: { shipmentId_contractVersionId: { shipmentId: "s1", contractVersionId: "v1" } },
      create: {
        tenantId: "t1",
        shipmentId: "s1",
        contractVersionId: "v1",
        isPrimary: true,
        source: "API",
        polCode: "DEHAM",
        podCode: "USCHI",
        equipmentType: "40HC",
        appliedNotes: "note",
        createdById: "u1",
      },
      update: {
        isPrimary: true,
        source: "API",
        polCode: "DEHAM",
        podCode: "USCHI",
        equipmentType: "40HC",
        appliedNotes: "note",
      },
    });
  });

  it("does not clear primaries when isPrimary is false", async () => {
    await attachTariffVersionToShipment({
      tenantId: "t1",
      shipmentId: "s1",
      contractVersionId: "v1",
      isPrimary: false,
      createdById: "u1",
    });
    expect(txMock.tariffShipmentApplication.updateMany).not.toHaveBeenCalled();
    expect(txMock.tariffShipmentApplication.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ isPrimary: false }),
        update: expect.objectContaining({ isPrimary: false }),
      }),
    );
  });
});
