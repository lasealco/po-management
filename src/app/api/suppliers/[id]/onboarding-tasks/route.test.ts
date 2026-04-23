import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const supplierFindFirstMock = vi.fn();
const taskFindManyMock = vi.fn();
const ensureMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/srm/ensure-supplier-onboarding-tasks", () => ({
  ensureSupplierOnboardingTasks: (...a: unknown[]) => ensureMock(...a),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    supplier: { findFirst: supplierFindFirstMock },
    supplierOnboardingTask: { findMany: taskFindManyMock },
  },
}));

describe("GET /api/suppliers/[id]/onboarding-tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    ensureMock.mockResolvedValue(undefined);
  });

  it("returns gate when requireApiGrant denies", async () => {
    const gate = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    requireApiGrantMock.mockResolvedValueOnce(gate);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/x/onboarding-tasks"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res).toBe(gate);
    expect(supplierFindFirstMock).not.toHaveBeenCalled();
  });

  it("returns 404 when tenant missing", async () => {
    getDemoTenantMock.mockResolvedValueOnce(null);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/s1/onboarding-tasks"), {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when supplier not in tenant", async () => {
    supplierFindFirstMock.mockResolvedValueOnce(null);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/missing/onboarding-tasks"), {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
    expect(ensureMock).not.toHaveBeenCalled();
  });

  it("ensures default tasks, then returns task list for supplier", async () => {
    supplierFindFirstMock.mockResolvedValueOnce({ id: "s1" });
    const due = new Date("2026-01-15T00:00:00.000Z");
    taskFindManyMock.mockResolvedValueOnce([
      {
        id: "t1",
        taskKey: "a",
        title: "Profile",
        sortOrder: 0,
        done: false,
        assigneeUserId: null,
        dueAt: due,
        notes: "x",
        assignee: null,
      },
    ]);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/s1/onboarding-tasks"), {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tasks: { id: string; title: string; dueAt: string | null }[] };
    expect(ensureMock).toHaveBeenCalled();
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].id).toBe("t1");
    expect(body.tasks[0].title).toBe("Profile");
    expect(body.tasks[0].dueAt).toBe(due.toISOString());
  });
});
