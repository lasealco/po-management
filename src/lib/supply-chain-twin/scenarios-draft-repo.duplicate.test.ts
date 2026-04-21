import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();
const createMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplyChainTwinScenarioDraft: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
  },
}));

describe("duplicateScenarioDraftForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when source row is absent (cross-tenant id)", async () => {
    findFirstMock.mockResolvedValue(null);

    const { duplicateScenarioDraftForTenant } = await import("./scenarios-draft-repo");
    await expect(duplicateScenarioDraftForTenant("t1", "missing")).resolves.toBeNull();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates a new row with copied draftJson and optional suffixed title", async () => {
    findFirstMock.mockResolvedValue({
      title: "Base",
      draftJson: { shocks: [{ id: 1 }] },
    });
    createMock.mockResolvedValue({
      id: "new-id",
      title: "Base (v2)",
      status: "draft",
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    const { duplicateScenarioDraftForTenant } = await import("./scenarios-draft-repo");
    const row = await duplicateScenarioDraftForTenant("t1", "src", { titleSuffix: " (v2)" });

    expect(row?.id).toBe("new-id");
    expect(createMock).toHaveBeenCalledWith({
      data: {
        tenantId: "t1",
        title: "Base (v2)",
        status: "draft",
        draftJson: { shocks: [{ id: 1 }] },
      },
      select: { id: true, title: true, status: true, updatedAt: true },
    });
  });
});
