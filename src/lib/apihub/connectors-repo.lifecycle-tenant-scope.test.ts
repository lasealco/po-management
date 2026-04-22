import { beforeEach, describe, expect, it, vi } from "vitest";

const txFindFirst = vi.fn();
const txUpdateMany = vi.fn();
const txFindFirstOrThrow = vi.fn();
const auditCreate = vi.fn();

function makeTx() {
  return {
    apiHubConnector: {
      findFirst: txFindFirst,
      updateMany: txUpdateMany,
      findFirstOrThrow: txFindFirstOrThrow,
    },
    apiHubConnectorAuditLog: {
      create: auditCreate,
    },
  };
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => fn(makeTx())),
  },
}));

const listRow = {
  id: "conn-a",
  name: "C",
  sourceKind: "stub",
  status: "active",
  authMode: "none",
  authState: "not_configured",
  authConfigRef: null,
  lastSyncAt: null,
  healthSummary: "ok",
  opsNote: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("connectors-repo lifecycle tenant scoping (Slice 61)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txFindFirst.mockResolvedValue({
      id: "conn-a",
      status: "draft",
      opsNote: null,
      authConfigRef: null,
    });
    txUpdateMany.mockResolvedValue({ count: 1 });
    txFindFirstOrThrow.mockResolvedValue(listRow);
  });

  it("updateApiHubConnectorLifecycle uses updateMany with id + tenantId", async () => {
    const { updateApiHubConnectorLifecycle } = await import("./connectors-repo");
    await updateApiHubConnectorLifecycle({
      tenantId: "tenant-x",
      connectorId: "conn-a",
      actorUserId: "u1",
      status: "active",
      syncNow: false,
      note: null,
    });
    expect(txUpdateMany).toHaveBeenCalledWith({
      where: { id: "conn-a", tenantId: "tenant-x" },
      data: { status: "active" },
    });
    expect(txFindFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conn-a", tenantId: "tenant-x" },
      }),
    );
  });

  it("updateApiHubConnectorLifecycle scopes findFirstOrThrow when there is no row mutation", async () => {
    txFindFirst.mockResolvedValue({
      id: "conn-a",
      status: "draft",
      opsNote: null,
      authConfigRef: null,
    });
    const { updateApiHubConnectorLifecycle } = await import("./connectors-repo");
    await updateApiHubConnectorLifecycle({
      tenantId: "tenant-y",
      connectorId: "conn-a",
      actorUserId: "u1",
      status: "draft",
      syncNow: false,
      note: null,
    });
    expect(txUpdateMany).not.toHaveBeenCalled();
    expect(txFindFirstOrThrow).toHaveBeenCalledWith({
      where: { id: "conn-a", tenantId: "tenant-y" },
      select: expect.any(Object) as unknown,
    });
  });
});
