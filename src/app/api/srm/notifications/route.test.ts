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

  it("includes actorName and actorUserId when the actor is linked", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "n1",
        kind: "ONBOARDING_TASK_ASSIGNED",
        title: "Assigned",
        body: null,
        readAt: null,
        supplierId: "s1",
        taskId: "k1",
        actorUserId: "a1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        actor: { name: "Alex" },
        supplier: { name: "Acme Co", code: "AC-1" },
      },
    ]);
    countMock.mockResolvedValue(1);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/srm/notifications"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      notifications: {
        actorName: string | null;
        actorUserId: string | null;
        supplierName: string | null;
        supplierCode: string | null;
      }[];
    };
    expect(body.notifications[0]?.actorName).toBe("Alex");
    expect(body.notifications[0]?.actorUserId).toBe("a1");
    expect(body.notifications[0]?.supplierName).toBe("Acme Co");
    expect(body.notifications[0]?.supplierCode).toBe("AC-1");
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
