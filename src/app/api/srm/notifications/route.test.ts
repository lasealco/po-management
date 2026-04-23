import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getDemoTenantMock = vi.fn();
const findManyMock = vi.fn();
const countMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: getActorUserIdMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    srmOperatorNotification: { findMany: findManyMock, count: countMock, updateMany: updateManyMock },
  },
}));

describe("GET /api/srm/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getActorUserIdMock.mockResolvedValue("u1");
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
  });

  it("applies readAt null when unread=1", async () => {
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/srm/notifications?unread=1"));
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          userId: "u1",
          readAt: null,
        }),
      }),
    );
  });
});

describe("POST /api/srm/notifications (mark all read)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getActorUserIdMock.mockResolvedValue("u1");
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    updateManyMock.mockResolvedValue({ count: 2 });
  });

  it("returns 400 without markAllRead", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } }),
    );
    expect(res.status).toBe(400);
  });

  it("markAllRead updates unread rows", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; updated: number };
    expect(body.ok).toBe(true);
    expect(body.updated).toBe(2);
    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", userId: "u1", readAt: null },
      }),
    );
  });
});
