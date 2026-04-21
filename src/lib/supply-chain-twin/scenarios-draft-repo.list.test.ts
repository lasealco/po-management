import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  decodeTwinScenariosListCursor,
  encodeTwinScenariosListCursor,
} from "@/lib/supply-chain-twin/schemas/twin-scenarios-list-query";

const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplyChainTwinScenarioDraft: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

describe("listScenarioDraftsForTenantPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses tenant-only filter and take limit+1 for the first page (no offset)", async () => {
    findManyMock.mockResolvedValue([]);

    const { listScenarioDraftsForTenantPage } = await import("./scenarios-draft-repo");
    await expect(listScenarioDraftsForTenantPage("tenant-1", { limit: 10 })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });

    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", status: { not: "archived" } },
      select: { id: true, title: true, status: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 11,
    });
  });

  it("applies keyset OR after cursor without OFFSET", async () => {
    findManyMock.mockResolvedValue([]);
    const updatedAt = new Date("2026-02-15T12:30:00.000Z");
    const id = "cursor-id-1";

    const { listScenarioDraftsForTenantPage } = await import("./scenarios-draft-repo");
    await listScenarioDraftsForTenantPage("tenant-1", {
      limit: 25,
      cursorPosition: { updatedAt, id },
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        status: { not: "archived" },
        OR: [
          { updatedAt: { lt: updatedAt } },
          { AND: [{ updatedAt }, { id: { lt: id } }] },
        ],
      },
      select: { id: true, title: true, status: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 26,
    });
  });

  it("returns nextCursor from the last row when more than limit rows exist", async () => {
    const row0 = { id: "first", title: "A", status: "draft", updatedAt: new Date("2026-03-01T00:00:00.000Z") };
    const row1 = { id: "second", title: null, status: "draft", updatedAt: new Date("2026-02-28T00:00:00.000Z") };
    findManyMock.mockResolvedValue([row0, row1]);

    const { listScenarioDraftsForTenantPage } = await import("./scenarios-draft-repo");
    const page = await listScenarioDraftsForTenantPage("tenant-1", { limit: 1 });

    expect(page.items).toEqual([row0]);
    expect(page.nextCursor).not.toBeNull();
    const decoded = decodeTwinScenariosListCursor(page.nextCursor!);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.id).toBe(row0.id);
      expect(decoded.updatedAt.getTime()).toBe(row0.updatedAt.getTime());
    }
    expect(encodeTwinScenariosListCursor({ updatedAt: row0.updatedAt, id: row0.id })).toBe(page.nextCursor);
  });
});
