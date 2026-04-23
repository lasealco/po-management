import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const findFirstMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: (...a: unknown[]) => getActorUserIdMock(...a),
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/srm/emit-srm-operator-notification", () => ({
  emitSrmOperatorNotification: vi.fn().mockResolvedValue(undefined),
  SRM_NOTIFICATION_KIND: { ONBOARDING_TASK_ASSIGNED: "onboarding_task_assigned" },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplierOnboardingTask: { findFirst: findFirstMock, update: updateMock },
  },
}));

describe("PATCH /api/suppliers/[id]/onboarding-tasks/[taskId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
  });

  it("returns gate when requireApiGrant denies", async () => {
    const gate = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    requireApiGrantMock.mockResolvedValueOnce(gate);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/api/s1/onboarding-tasks/t1", { method: "PATCH", body: "{}" }),
      { params: Promise.resolve({ id: "s1", taskId: "t1" }) },
    );
    expect(res).toBe(gate);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("returns 404 when task not found in tenant", async () => {
    findFirstMock.mockResolvedValueOnce(null);
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/api/s1/onboarding-tasks/missing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      }),
      { params: Promise.resolve({ id: "s1", taskId: "missing" }) },
    );
    expect(res.status).toBe(404);
  });

  it("toggles done and returns task json", async () => {
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    findFirstMock.mockResolvedValueOnce({
      id: "t1",
      assigneeUserId: null,
      title: "Verify profile",
      supplier: { name: "Acme" },
    });
    updateMock.mockResolvedValueOnce({
      id: "t1",
      taskKey: "k1",
      title: "Verify profile",
      sortOrder: 0,
      done: true,
      assigneeUserId: null,
      dueAt: null,
      notes: null,
      assignee: null,
    });
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/api/s1/onboarding-tasks/t1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      }),
      { params: Promise.resolve({ id: "s1", taskId: "t1" }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { task: { done: boolean; title: string } };
    expect(body.task.done).toBe(true);
    expect(body.task.title).toBe("Verify profile");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1" },
        data: { done: true },
      }),
    );
  });
});
