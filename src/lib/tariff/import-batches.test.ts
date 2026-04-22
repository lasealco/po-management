import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTariffImportBatch,
  getTariffImportBatchForTenant,
  listTariffImportBatchesForTenant,
  updateTariffImportBatch,
} from "./import-batches";

const prismaMock = vi.hoisted(() => ({
  tariffImportBatch: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("listTariffImportBatchesForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caps take at 300 and scopes by tenant", async () => {
    prismaMock.tariffImportBatch.findMany.mockResolvedValue([]);
    await listTariffImportBatchesForTenant({ tenantId: "t1", take: 999 });
    expect(prismaMock.tariffImportBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t1" },
        take: 300,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { legalEntity: { select: { id: true, name: true, code: true } } },
      }),
    );
  });
});

describe("getTariffImportBatchForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws NOT_FOUND when batch is missing for tenant", async () => {
    prismaMock.tariffImportBatch.findFirst.mockResolvedValue(null);
    await expect(getTariffImportBatchForTenant({ tenantId: "t1", batchId: "b-missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(prismaMock.tariffImportBatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "b-missing", tenantId: "t1" },
        include: expect.objectContaining({
          legalEntity: { select: { id: true, name: true, code: true } },
          stagingRows: { orderBy: { createdAt: "asc" } },
        }),
      }),
    );
  });
});

describe("createTariffImportBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffImportBatch.create.mockResolvedValue({ id: "new-batch" });
  });

  it("rejects invalid parseStatus or reviewStatus", async () => {
    await expect(
      createTariffImportBatch({ tenantId: "t1", sourceType: "EXCEL", parseStatus: "NOT_A_STATUS" }),
    ).rejects.toMatchObject({ code: "BAD_INPUT" });
    expect(prismaMock.tariffImportBatch.create).not.toHaveBeenCalled();

    await expect(
      createTariffImportBatch({ tenantId: "t1", sourceType: "EXCEL", reviewStatus: "NOT_A_STATUS" }),
    ).rejects.toMatchObject({ code: "BAD_INPUT" });
  });

  it("defaults statuses, trims string fields, and creates", async () => {
    await createTariffImportBatch({
      tenantId: "t1",
      sourceType: "EXCEL",
      uploadedFilename: "  sheet.xlsx  ",
      sourceReference: "  ref  ",
      sourceFileUrl: "  https://x  ",
      sourceMimeType: "  application/pdf  ",
    });
    expect(prismaMock.tariffImportBatch.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t1",
        legalEntityId: null,
        sourceType: "EXCEL",
        uploadedFilename: "sheet.xlsx",
        sourceReference: "ref",
        sourceFileUrl: "https://x",
        sourceMimeType: "application/pdf",
        sourceByteSize: null,
        sourceMetadata: undefined,
        parseStatus: "UPLOADED",
        reviewStatus: "PENDING",
      },
    });
  });
});

describe("updateTariffImportBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffImportBatch.findFirst.mockResolvedValue({ id: "b1" });
    prismaMock.tariffImportBatch.update.mockResolvedValue({ id: "b1" });
  });

  it("throws NOT_FOUND when batch is missing", async () => {
    prismaMock.tariffImportBatch.findFirst.mockResolvedValue(null);
    await expect(updateTariffImportBatch("t1", "gone", { parseStatus: "PARSED_OK" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(prismaMock.tariffImportBatch.update).not.toHaveBeenCalled();
  });

  it("rejects invalid parseStatus or reviewStatus on patch", async () => {
    await expect(updateTariffImportBatch("t1", "b1", { parseStatus: "INVALID" })).rejects.toMatchObject({
      code: "BAD_INPUT",
    });
    await expect(updateTariffImportBatch("t1", "b1", { reviewStatus: "INVALID" })).rejects.toMatchObject({
      code: "BAD_INPUT",
    });
    expect(prismaMock.tariffImportBatch.update).not.toHaveBeenCalled();
  });

  it("updates allowed fields when validation passes", async () => {
    await updateTariffImportBatch("t1", "b1", {
      parseStatus: "PARSED_OK",
      reviewStatus: "READY_TO_APPLY",
      confidenceScore: 0.92,
      sourceReference: "new-ref",
    });
    expect(prismaMock.tariffImportBatch.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: {
        parseStatus: "PARSED_OK",
        reviewStatus: "READY_TO_APPLY",
        confidenceScore: 0.92,
        sourceReference: "new-ref",
      },
    });
  });
});
