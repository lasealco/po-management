import { beforeEach, describe, expect, it, vi } from "vitest";

import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

const h = vi.hoisted(() => ({
  getTariffImportBatchForTenant: vi.fn(),
  updateTariffImportBatch: vi.fn(),
  createTariffContractVersion: vi.fn(),
  createTariffRateLine: vi.fn(),
  createTariffChargeLine: vi.fn(),
  recordTariffAuditLog: vi.fn(),
  headerFindFirst: vi.fn(),
  versionDeleteMany: vi.fn(),
}));

vi.mock("@/lib/tariff/import-batches", () => ({
  getTariffImportBatchForTenant: h.getTariffImportBatchForTenant,
  updateTariffImportBatch: h.updateTariffImportBatch,
}));

vi.mock("@/lib/tariff/contract-versions", () => ({
  createTariffContractVersion: h.createTariffContractVersion,
}));

vi.mock("@/lib/tariff/rate-lines", () => ({
  createTariffRateLine: h.createTariffRateLine,
}));

vi.mock("@/lib/tariff/charge-lines", () => ({
  createTariffChargeLine: h.createTariffChargeLine,
}));

vi.mock("@/lib/tariff/audit-log", () => ({
  recordTariffAuditLog: h.recordTariffAuditLog,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tariffContractHeader: {
      findFirst: h.headerFindFirst,
    },
    tariffContractVersion: {
      deleteMany: h.versionDeleteMany,
    },
  },
}));

function readyBatchWithRows(
  stagingRows: Array<{
    id: string;
    approved: boolean;
    rowType: string;
    normalizedPayload: Record<string, unknown> | null;
  }>,
  reviewStatus = "READY_TO_APPLY",
) {
  return { reviewStatus, stagingRows };
}

describe("promoteApprovedStagingRowsToNewVersion (workflow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.headerFindFirst.mockResolvedValue({ id: "hdr-1" });
    h.versionDeleteMany.mockResolvedValue({ count: 1 });
    h.createTariffContractVersion.mockResolvedValue({ id: "ver-new" });
    h.createTariffRateLine.mockResolvedValue({ id: "rl-1" });
    h.createTariffChargeLine.mockResolvedValue({ id: "cl-1" });
  });

  it("throws CONFLICT when batch is already APPLIED", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(readyBatchWithRows([], "APPLIED"));

    await expect(
      promoteApprovedStagingRowsToNewVersion({
        tenantId: "t1",
        importBatchId: "b1",
        contractHeaderId: "hdr-1",
        actorUserId: "u1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(h.createTariffContractVersion).not.toHaveBeenCalled();
  });

  it("throws BAD_INPUT when reviewStatus is not READY_TO_APPLY", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(readyBatchWithRows([], "PENDING"));

    await expect(
      promoteApprovedStagingRowsToNewVersion({
        tenantId: "t1",
        importBatchId: "b1",
        contractHeaderId: "hdr-1",
        actorUserId: "u1",
      }),
    ).rejects.toMatchObject({ code: "BAD_INPUT" });

    expect(h.createTariffContractVersion).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when contract header is missing for tenant", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.headerFindFirst.mockResolvedValue(null);
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "r1",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            rateType: "BASE_RATE",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 1,
          },
        },
      ]),
    );

    await expect(
      promoteApprovedStagingRowsToNewVersion({
        tenantId: "t1",
        importBatchId: "b1",
        contractHeaderId: "missing-hdr",
        actorUserId: "u1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(h.createTariffContractVersion).not.toHaveBeenCalled();
  });

  it("throws BAD_INPUT when duplicate approved promotable payloads exist", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    const payload = {
      rateType: "BASE_RATE",
      unitBasis: "CONTAINER",
      currency: "USD",
      amount: "100",
    };
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        { id: "a", approved: true, rowType: "RATE_LINE_CANDIDATE", normalizedPayload: { ...payload } },
        { id: "b", approved: true, rowType: "RATE_LINE_CANDIDATE", normalizedPayload: { ...payload } },
      ]),
    );

    await expect(
      promoteApprovedStagingRowsToNewVersion({
        tenantId: "t1",
        importBatchId: "b1",
        contractHeaderId: "hdr-1",
        actorUserId: "u1",
      }),
    ).rejects.toMatchObject({ code: "BAD_INPUT" });

    expect(h.createTariffContractVersion).not.toHaveBeenCalled();
  });

  it("throws BAD_INPUT when no approved RATE/CHARGE candidates", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        { id: "x", approved: false, rowType: "RATE_LINE_CANDIDATE", normalizedPayload: {} },
      ]),
    );

    await expect(
      promoteApprovedStagingRowsToNewVersion({
        tenantId: "t1",
        importBatchId: "b1",
        contractHeaderId: "hdr-1",
        actorUserId: "u1",
      }),
    ).rejects.toMatchObject({ code: "BAD_INPUT", message: /No approved/ });

    expect(h.createTariffContractVersion).not.toHaveBeenCalled();
  });

  it("creates version, rate lines, marks batch APPLIED, and records audit on success", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-rate",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            rateType: "BASE_RATE",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 250,
            equipmentType: "40HC",
          },
        },
        {
          id: "row-charge",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            rawChargeName: "BAF",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 50,
            isIncluded: false,
            isMandatory: true,
          },
        },
      ]),
    );

    const out = await promoteApprovedStagingRowsToNewVersion({
      tenantId: "t1",
      importBatchId: "batch-x",
      contractHeaderId: "hdr-1",
      actorUserId: "actor-1",
    });

    expect(out).toEqual({ versionId: "ver-new", rateLineCount: 1, chargeLineCount: 1 });

    expect(h.createTariffContractVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        contractHeaderId: "hdr-1",
        sourceType: "EXCEL",
        sourceReference: "import:batch-x",
        approvalStatus: "PENDING",
        status: "DRAFT",
      }),
    );

    expect(h.createTariffRateLine).toHaveBeenCalledTimes(1);
    expect(h.createTariffRateLine).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        contractVersionId: "ver-new",
        rateType: "BASE_RATE",
        unitBasis: "CONTAINER",
        currency: "USD",
        equipmentType: "40HC",
      }),
    );

    expect(h.createTariffChargeLine).toHaveBeenCalledTimes(1);
    expect(h.createTariffChargeLine).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        contractVersionId: "ver-new",
        rawChargeName: "BAF",
        isIncluded: false,
        isMandatory: true,
      }),
    );

    expect(h.updateTariffImportBatch).toHaveBeenCalledWith("t1", "batch-x", {
      reviewStatus: "APPLIED",
      parseStatus: "PARSED_OK",
    });

    expect(h.recordTariffAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        objectType: "contract_version",
        objectId: "ver-new",
        action: "import_promote",
        userId: "actor-1",
        newValue: expect.objectContaining({
          importBatchId: "batch-x",
          contractHeaderId: "hdr-1",
          rateLineCount: 1,
          chargeLineCount: 1,
        }),
      }),
    );

    expect(h.versionDeleteMany).not.toHaveBeenCalled();
  });

  it("best-effort deletes draft version when rate line creation fails after version create", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-rate",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            rateType: "BASE_RATE",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 1,
          },
        },
      ]),
    );
    h.createTariffRateLine.mockRejectedValueOnce(new Error("simulated DB failure"));

    await expect(
      promoteApprovedStagingRowsToNewVersion({
        tenantId: "t1",
        importBatchId: "b1",
        contractHeaderId: "hdr-1",
        actorUserId: "u1",
      }),
    ).rejects.toThrow("simulated DB failure");

    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
    expect(h.updateTariffImportBatch).not.toHaveBeenCalled();
    expect(h.recordTariffAuditLog).not.toHaveBeenCalled();
  });

  it("throws BAD_INPUT for unsupported rateType before persisting lines", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "bad-rate",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            rateType: "NOT_A_VALID_ENUM_VALUE_XYZ",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 1,
          },
        },
      ]),
    );

    const err = await promoteApprovedStagingRowsToNewVersion({
      tenantId: "t1",
      importBatchId: "b1",
      contractHeaderId: "hdr-1",
      actorUserId: "u1",
    }).catch((e) => e);

    expect(err).toBeInstanceOf(TariffRepoError);
    expect((err as TariffRepoError).code).toBe("BAD_INPUT");
    expect((err as TariffRepoError).message).toMatch(/unsupported rateType/);

    expect(h.createTariffRateLine).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
  });
});
