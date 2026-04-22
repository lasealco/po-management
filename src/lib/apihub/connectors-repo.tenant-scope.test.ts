import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const findFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiHubConnector: {
      findMany,
      findFirst,
    },
    $transaction: vi.fn(async (fn: (tx: { apiHubConnector: { create: ReturnType<typeof vi.fn>; apiHubConnectorAuditLog?: unknown } }) => unknown) =>
      fn({
        apiHubConnector: {
          create: vi.fn().mockResolvedValue({}),
        },
      }),
    ),
  },
}));

describe("connectors-repo tenant scoping (Slice 61)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listApiHubConnectors passes tenantId in where", async () => {
    findMany.mockResolvedValue([]);
    const { listApiHubConnectors } = await import("./connectors-repo");
    await listApiHubConnectors("tenant-c1");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-c1" }),
      }),
    );
  });

  it("getApiHubConnectorInTenant passes tenantId in where", async () => {
    findFirst.mockResolvedValue(null);
    const { getApiHubConnectorInTenant } = await import("./connectors-repo");
    await getApiHubConnectorInTenant("tenant-c2", "conn-x");
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "conn-x", tenantId: "tenant-c2" },
      select: { id: true, status: true },
    });
  });
});
