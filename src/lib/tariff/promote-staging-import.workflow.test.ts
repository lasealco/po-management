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
    normalizedPayload: unknown;
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

  it("propagates when createTariffContractVersion fails (no lines written, no rollback delete)", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
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
    h.createTariffContractVersion.mockRejectedValueOnce(new Error("version create failed"));

    await expect(
      promoteApprovedStagingRowsToNewVersion({
        tenantId: "t1",
        importBatchId: "b1",
        contractHeaderId: "hdr-1",
        actorUserId: "u1",
      }),
    ).rejects.toThrow("version create failed");

    expect(h.createTariffRateLine).not.toHaveBeenCalled();
    expect(h.createTariffChargeLine).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).not.toHaveBeenCalled();
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

  it("promotes only approved rows when batch mixes approved and unapproved candidates", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "approved-rate",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            rateType: "BASE_RATE",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 100,
          },
        },
        {
          id: "skipped-rate",
          approved: false,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            rateType: "BASE_RATE",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 999,
          },
        },
        {
          id: "skipped-charge",
          approved: false,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            rawChargeName: "IGNORED",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 50,
          },
        },
      ]),
    );

    const out = await promoteApprovedStagingRowsToNewVersion({
      tenantId: "t1",
      importBatchId: "batch-mixed",
      contractHeaderId: "hdr-1",
      actorUserId: "u1",
    });

    expect(out).toEqual({ versionId: "ver-new", rateLineCount: 1, chargeLineCount: 0 });
    expect(h.createTariffRateLine).toHaveBeenCalledTimes(1);
    expect(h.createTariffChargeLine).not.toHaveBeenCalled();
    expect(h.createTariffRateLine).toHaveBeenCalledWith(
      expect.objectContaining({ contractVersionId: "ver-new", amount: 100 }),
    );
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

    expect(h.headerFindFirst).toHaveBeenCalledWith({
      where: { id: "hdr-1", tenantId: "t1" },
      select: { id: true },
    });

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

  it("succeeds with only approved charge rows", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "c1",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            rawChargeName: "BAF",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 10,
          },
        },
        {
          id: "c2",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            rawChargeName: "DOC",
            unitBasis: "BL",
            currency: "EUR",
            amount: 35,
          },
        },
      ]),
    );

    const out = await promoteApprovedStagingRowsToNewVersion({
      tenantId: "t1",
      importBatchId: "batch-charges",
      contractHeaderId: "hdr-1",
      actorUserId: null,
    });

    expect(out).toEqual({ versionId: "ver-new", rateLineCount: 0, chargeLineCount: 2 });
    expect(h.createTariffRateLine).not.toHaveBeenCalled();
    expect(h.createTariffChargeLine).toHaveBeenCalledTimes(2);
    expect(h.updateTariffImportBatch).toHaveBeenCalledWith("t1", "batch-charges", {
      reviewStatus: "APPLIED",
      parseStatus: "PARSED_OK",
    });
    expect(h.recordTariffAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        newValue: expect.objectContaining({
          rateLineCount: 0,
          chargeLineCount: 2,
        }),
      }),
    );
  });

  it("succeeds with only approved rate rows", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
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
            amount: 1000,
          },
        },
        {
          id: "r2",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            rateType: "ALL_IN",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 1200,
          },
        },
      ]),
    );

    const out = await promoteApprovedStagingRowsToNewVersion({
      tenantId: "t1",
      importBatchId: "batch-rates",
      contractHeaderId: "hdr-1",
      actorUserId: "u99",
    });

    expect(out).toEqual({ versionId: "ver-new", rateLineCount: 2, chargeLineCount: 0 });
    expect(h.createTariffRateLine).toHaveBeenCalledTimes(2);
    expect(h.createTariffChargeLine).not.toHaveBeenCalled();
    expect(h.recordTariffAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: expect.objectContaining({
          rateLineCount: 2,
          chargeLineCount: 0,
        }),
      }),
    );
  });

  it("forwards optional scope fields from normalized payloads into line creators", async () => {
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
            commodityScope: "  FMCG  ",
            serviceScope: "CY/CY",
            originScopeId: "scope-o1",
            destinationScopeId: "scope-d1",
            rawRateDescription: "  Ocean leg  ",
          },
        },
        {
          id: "row-charge",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            rawChargeName: "THC",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 40,
            normalizedChargeCodeId: "ncc-1",
            geographyScopeId: "geo-1",
            equipmentScope: "  40HC  ",
            directionScope: "EXPORT",
            conditionScope: null,
            isIncluded: true,
            isMandatory: false,
          },
        },
      ]),
    );

    await promoteApprovedStagingRowsToNewVersion({
      tenantId: "t1",
      importBatchId: "batch-scopes",
      contractHeaderId: "hdr-1",
      actorUserId: "u1",
    });

    expect(h.createTariffRateLine).toHaveBeenCalledWith(
      expect.objectContaining({
        commodityScope: "FMCG",
        serviceScope: "CY/CY",
        originScopeId: "scope-o1",
        destinationScopeId: "scope-d1",
        rawRateDescription: "Ocean leg",
      }),
    );
    expect(h.createTariffChargeLine).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedChargeCodeId: "ncc-1",
        geographyScopeId: "geo-1",
        equipmentScope: "40HC",
        directionScope: "EXPORT",
        conditionScope: null,
        isIncluded: true,
        isMandatory: false,
      }),
    );
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

  it("best-effort deletes draft version when the second rate line persist fails", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-rate-1",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            rateType: "BASE_RATE",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 1,
          },
        },
        {
          id: "row-rate-2",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            rateType: "BASE_RATE",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 2,
          },
        },
      ]),
    );
    h.createTariffRateLine
      .mockResolvedValueOnce({ id: "rl-first" })
      .mockRejectedValueOnce(new Error("second rate persist failed"));

    await expect(
      promoteApprovedStagingRowsToNewVersion({
        tenantId: "t1",
        importBatchId: "b1",
        contractHeaderId: "hdr-1",
        actorUserId: "u1",
      }),
    ).rejects.toThrow("second rate persist failed");

    expect(h.createTariffRateLine).toHaveBeenCalledTimes(2);
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
    expect(h.updateTariffImportBatch).not.toHaveBeenCalled();
    expect(h.recordTariffAuditLog).not.toHaveBeenCalled();
  });

  it("best-effort deletes draft version when the second charge line persist fails", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "c1",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            rawChargeName: "BAF",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 1,
          },
        },
        {
          id: "c2",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            rawChargeName: "DOC",
            unitBasis: "BL",
            currency: "USD",
            amount: 2,
          },
        },
      ]),
    );
    h.createTariffChargeLine
      .mockResolvedValueOnce({ id: "cl-first" })
      .mockRejectedValueOnce(new Error("second charge persist failed"));

    await expect(
      promoteApprovedStagingRowsToNewVersion({
        tenantId: "t1",
        importBatchId: "b1",
        contractHeaderId: "hdr-1",
        actorUserId: "u1",
      }),
    ).rejects.toThrow("second charge persist failed");

    expect(h.createTariffChargeLine).toHaveBeenCalledTimes(2);
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
    expect(h.updateTariffImportBatch).not.toHaveBeenCalled();
    expect(h.recordTariffAuditLog).not.toHaveBeenCalled();
  });

  it("best-effort deletes draft version when charge line creation fails after version create", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-charge",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            rawChargeName: "BAF",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 1,
          },
        },
      ]),
    );
    h.createTariffChargeLine.mockRejectedValueOnce(new Error("simulated charge persist failure"));

    await expect(
      promoteApprovedStagingRowsToNewVersion({
        tenantId: "t1",
        importBatchId: "b1",
        contractHeaderId: "hdr-1",
        actorUserId: "u1",
      }),
    ).rejects.toThrow("simulated charge persist failure");

    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
    expect(h.updateTariffImportBatch).not.toHaveBeenCalled();
    expect(h.recordTariffAuditLog).not.toHaveBeenCalled();
  });

  it("best-effort deletes draft version when batch update fails after lines are written", async () => {
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
    h.updateTariffImportBatch.mockRejectedValueOnce(new Error("batch status update failed"));

    await expect(
      promoteApprovedStagingRowsToNewVersion({
        tenantId: "t1",
        importBatchId: "b1",
        contractHeaderId: "hdr-1",
        actorUserId: "u1",
      }),
    ).rejects.toThrow("batch status update failed");

    expect(h.createTariffRateLine).toHaveBeenCalledTimes(1);
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
    expect(h.recordTariffAuditLog).not.toHaveBeenCalled();
  });

  it("rolls back when a valid rate row is followed by an invalid charge row", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "ok-rate",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            rateType: "BASE_RATE",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 1,
          },
        },
        {
          id: "bad-charge",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            rawChargeName: "BAF",
            unitBasis: "CONTAINER",
            currency: "USD",
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
    expect((err as TariffRepoError).message).toMatch(
      /Charge staging row bad-charge missing rawChargeName, unitBasis, currency, or amount/,
    );

    expect(h.createTariffRateLine).toHaveBeenCalledTimes(1);
    expect(h.createTariffChargeLine).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
  });

  it("rolls back when a valid charge row is followed by an invalid rate row", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "ok-charge",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            rawChargeName: "DOC",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 5,
          },
        },
        {
          id: "bad-rate",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            rateType: "BASE_RATE",
            unitBasis: "CONTAINER",
            currency: "USD",
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
    expect((err as TariffRepoError).message).toMatch(
      /Rate staging row bad-rate missing rateType, unitBasis, currency, or amount/,
    );

    expect(h.createTariffChargeLine).toHaveBeenCalledTimes(1);
    expect(h.createTariffRateLine).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
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

  it("throws BAD_INPUT when rate row is missing currency (rolls back version)", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-bad-rate",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            rateType: "BASE_RATE",
            unitBasis: "CONTAINER",
            amount: 100,
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
    expect((err as TariffRepoError).message).toMatch(/missing rateType, unitBasis, currency, or amount/);

    expect(h.createTariffRateLine).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
  });

  it("throws BAD_INPUT when charge row is missing rawChargeName (rolls back version)", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-bad-charge",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 25,
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
    expect((err as TariffRepoError).message).toMatch(/Charge staging row.*missing rawChargeName/);

    expect(h.createTariffChargeLine).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
  });

  it("throws BAD_INPUT when approved row normalizedPayload is not an object (no version created)", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-bad-payload",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: null,
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
    expect((err as TariffRepoError).message).toMatch(/must have an object normalizedPayload/);

    expect(h.createTariffContractVersion).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).not.toHaveBeenCalled();
  });

  it("throws BAD_INPUT when charge row is missing amount (rolls back version)", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-charge-no-amt",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            rawChargeName: "BAF",
            unitBasis: "CONTAINER",
            currency: "USD",
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
    expect((err as TariffRepoError).message).toMatch(
      /Charge staging row.*missing rawChargeName, unitBasis, currency, or amount/,
    );

    expect(h.createTariffChargeLine).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
  });

  it("throws BAD_INPUT when approved row normalizedPayload is an array (no version created)", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-array-payload",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: [{ rawChargeName: "X" }],
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
    expect((err as TariffRepoError).message).toMatch(/must have an object normalizedPayload/);

    expect(h.createTariffContractVersion).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).not.toHaveBeenCalled();
  });

  it("throws BAD_INPUT when rate row is missing unitBasis (rolls back version)", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-no-unit",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            rateType: "BASE_RATE",
            currency: "USD",
            amount: 100,
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
    expect((err as TariffRepoError).message).toMatch(/missing rateType, unitBasis, currency, or amount/);

    expect(h.createTariffRateLine).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
  });

  it("throws BAD_INPUT when charge row is missing unitBasis (rolls back version)", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-charge-no-ub",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            rawChargeName: "BAF",
            currency: "USD",
            amount: 25,
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
    expect((err as TariffRepoError).message).toMatch(
      /Charge staging row.*missing rawChargeName, unitBasis, currency, or amount/,
    );

    expect(h.createTariffChargeLine).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
  });

  it("throws BAD_INPUT when charge row is missing currency (rolls back version)", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-charge-no-ccy",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            rawChargeName: "BAF",
            unitBasis: "CONTAINER",
            amount: 25,
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
    expect((err as TariffRepoError).message).toMatch(
      /Charge staging row.*missing rawChargeName, unitBasis, currency, or amount/,
    );

    expect(h.createTariffChargeLine).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
  });

  it("throws BAD_INPUT when rate row is missing rateType (rolls back version)", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-no-rate-type",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: 100,
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
    expect((err as TariffRepoError).message).toMatch(/missing rateType, unitBasis, currency, or amount/);

    expect(h.createTariffRateLine).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
  });

  it("throws BAD_INPUT when rate row amount is NaN (rolls back version)", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-rate-nan",
          approved: true,
          rowType: "RATE_LINE_CANDIDATE",
          normalizedPayload: {
            rateType: "BASE_RATE",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: Number.NaN,
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
    expect((err as TariffRepoError).message).toMatch(/missing rateType, unitBasis, currency, or amount/);

    expect(h.createTariffRateLine).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
  });

  it("throws BAD_INPUT when charge row amount is not parseable as a number (rolls back version)", async () => {
    const { promoteApprovedStagingRowsToNewVersion } = await import("./promote-staging-import");
    h.getTariffImportBatchForTenant.mockResolvedValue(
      readyBatchWithRows([
        {
          id: "row-charge-bad-amt",
          approved: true,
          rowType: "CHARGE_LINE_CANDIDATE",
          normalizedPayload: {
            rawChargeName: "BAF",
            unitBasis: "CONTAINER",
            currency: "USD",
            amount: "12,000.00",
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
    expect((err as TariffRepoError).message).toMatch(
      /Charge staging row.*missing rawChargeName, unitBasis, currency, or amount/,
    );

    expect(h.createTariffChargeLine).not.toHaveBeenCalled();
    expect(h.versionDeleteMany).toHaveBeenCalledWith({ where: { id: "ver-new" } });
  });
});
