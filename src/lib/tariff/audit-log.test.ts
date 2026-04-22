import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listTariffAuditLogsForContractScope,
  recordTariffAuditLog,
  TARIFF_AUDIT_LOG_MAX_TAKE,
} from "./audit-log";

const prismaMock = vi.hoisted(() => ({
  tariffAuditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("tariff audit log constants", () => {
  it("caps list tail size for contract and object-type queries", () => {
    expect(TARIFF_AUDIT_LOG_MAX_TAKE).toBe(200);
  });
});

describe("recordTariffAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffAuditLog.create.mockResolvedValue({});
  });

  it("trims objectType and persists via prisma", async () => {
    await recordTariffAuditLog({
      objectType: "  contract_version  ",
      objectId: "v1",
      action: "import_promote",
      userId: "u1",
      newValue: { x: 1 },
    });
    expect(prismaMock.tariffAuditLog.create).toHaveBeenCalledWith({
      data: {
        objectType: "contract_version",
        objectId: "v1",
        action: "import_promote",
        userId: "u1",
        oldValue: undefined,
        newValue: { x: 1 },
      },
    });
  });

  it("throws when objectType is empty after trim", async () => {
    await expect(
      recordTariffAuditLog({
        objectType: "   ",
        objectId: "v1",
        action: "x",
        userId: null,
      }),
    ).rejects.toThrow(/objectType is required/);
    expect(prismaMock.tariffAuditLog.create).not.toHaveBeenCalled();
  });
});

describe("listTariffAuditLogsForContractScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.tariffAuditLog.findMany.mockResolvedValue([]);
  });

  it("caps take at TARIFF_AUDIT_LOG_MAX_TAKE and always includes header scope", async () => {
    await listTariffAuditLogsForContractScope({ headerId: "h1", versionIds: [], take: 999 });
    expect(prismaMock.tariffAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: TARIFF_AUDIT_LOG_MAX_TAKE,
        where: {
          OR: [{ objectType: "contract_header", objectId: "h1" }],
        },
      }),
    );
  });

  it("adds version and line predicates when ids are provided", async () => {
    await listTariffAuditLogsForContractScope({
      headerId: "h1",
      versionIds: ["v1"],
      relatedLineObjectIds: ["line-a"],
      take: 10,
    });
    expect(prismaMock.tariffAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        where: {
          OR: [
            { objectType: "contract_header", objectId: "h1" },
            { objectType: "contract_version", objectId: { in: ["v1"] } },
            {
              AND: [
                { objectId: { in: ["line-a"] } },
                {
                  objectType: {
                    in: ["tariff_rate_line", "tariff_charge_line", "tariff_free_time_rule"],
                  },
                },
              ],
            },
          ],
        },
      }),
    );
  });
});
