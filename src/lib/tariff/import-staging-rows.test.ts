import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTariffImportStagingRows,
  deleteStagingRowsForBatch,
  updateTariffImportStagingRow,
} from "./import-staging-rows";

const prismaMock = vi.hoisted(() => ({
  tariffImportBatch: { findFirst: vi.fn() },
  tariffImportStagingRow: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("createTariffImportStagingRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffImportBatch.findFirst.mockResolvedValue({ id: "b1" });
    prismaMock.tariffImportStagingRow.createMany.mockResolvedValue({ count: 1 });
  });

  it("throws NOT_FOUND when batch is not in tenant scope", async () => {
    prismaMock.tariffImportBatch.findFirst.mockResolvedValue(null);
    await expect(
      createTariffImportStagingRows("t1", "b1", [{ rowType: "RATE", rawPayload: {} }]),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffImportStagingRow.createMany).not.toHaveBeenCalled();
  });

  it("maps rows into createMany payload", async () => {
    await createTariffImportStagingRows("t1", "b1", [
      { rowType: "RATE", rawPayload: { a: 1 }, normalizedPayload: { b: 2 }, unresolvedFlags: { c: true } },
      { rowType: "CHARGE", rawPayload: { d: 1 } },
    ]);
    expect(prismaMock.tariffImportStagingRow.createMany).toHaveBeenCalledWith({
      data: [
        {
          importBatchId: "b1",
          rowType: "RATE",
          rawPayload: { a: 1 },
          normalizedPayload: { b: 2 },
          unresolvedFlags: { c: true },
        },
        {
          importBatchId: "b1",
          rowType: "CHARGE",
          rawPayload: { d: 1 },
          normalizedPayload: undefined,
          unresolvedFlags: undefined,
        },
      ],
    });
  });
});

describe("deleteStagingRowsForBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffImportBatch.findFirst.mockResolvedValue({ id: "b1" });
    prismaMock.tariffImportStagingRow.deleteMany.mockResolvedValue({ count: 3 });
  });

  it("throws NOT_FOUND when batch is missing", async () => {
    prismaMock.tariffImportBatch.findFirst.mockResolvedValue(null);
    await expect(deleteStagingRowsForBatch("t1", "b1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffImportStagingRow.deleteMany).not.toHaveBeenCalled();
  });

  it("deleteMany scoped to importBatchId", async () => {
    await deleteStagingRowsForBatch("t1", "b1");
    expect(prismaMock.tariffImportStagingRow.deleteMany).toHaveBeenCalledWith({ where: { importBatchId: "b1" } });
  });
});

describe("updateTariffImportStagingRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffImportStagingRow.findFirst.mockResolvedValue({ id: "r1" });
    prismaMock.tariffImportStagingRow.update.mockResolvedValue({ id: "r1" });
  });

  it("throws NOT_FOUND when row is not in batch/tenant scope", async () => {
    prismaMock.tariffImportStagingRow.findFirst.mockResolvedValue(null);
    await expect(
      updateTariffImportStagingRow("t1", "b1", "r1", { approved: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prismaMock.tariffImportStagingRow.update).not.toHaveBeenCalled();
  });

  it("uses DbNull when JSON patches are explicitly null", async () => {
    await updateTariffImportStagingRow("t1", "b1", "r1", {
      normalizedPayload: null,
      unresolvedFlags: null,
    });
    expect(prismaMock.tariffImportStagingRow.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: {
        normalizedPayload: Prisma.DbNull,
        unresolvedFlags: Prisma.DbNull,
      },
    });
  });

  it("forwards approved and confidenceScore when set", async () => {
    await updateTariffImportStagingRow("t1", "b1", "r1", { approved: true, confidenceScore: 0.9 });
    expect(prismaMock.tariffImportStagingRow.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { approved: true, confidenceScore: 0.9 },
    });
  });
});
