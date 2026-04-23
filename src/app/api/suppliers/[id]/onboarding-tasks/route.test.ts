import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const loadGlobalGrantsForUserMock = vi.fn();
const getDemoTenantMock = vi.fn();
const supplierFindFirstMock = vi.fn();
const taskFindManyMock = vi.fn();
const ensureMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: (...a: unknown[]) => getActorUserIdMock(...a),
  loadGlobalGrantsForUser: (...a: unknown[]) => loadGlobalGrantsForUserMock(...a),
  viewerHas: (set: Set<string>, resource: string, action: string) =>
    set.has(`${resource}\u0000${action}`),
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
    getActorUserIdMock.mockResolvedValue("u1");
    loadGlobalGrantsForUserMock.mockResolvedValue(
      new Set(["org.suppliers\u0000edit", "org.suppliers\u0000view"]),
    );
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

  it("redacts task notes and assignee email for view-only (suppliers view without edit/approve)", async () => {
    loadGlobalGrantsForUserMock.mockResolvedValueOnce(new Set(["org.suppliers\u0000view"]));
    supplierFindFirstMock.mockResolvedValueOnce({ id: "s1" });
    taskFindManyMock.mockResolvedValueOnce([
      {
        id: "t1",
        taskKey: "a",
        title: "Profile",
        sortOrder: 0,
        done: false,
        assigneeUserId: "u2",
        dueAt: null,
        notes: "secret",
        assignee: { id: "u2", name: "Bob", email: "bob@x.com" },
      },
    ]);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/s1/onboarding-tasks"), {
      params: Promise.resolve({ id: "s1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tasks: { notes: string | null; assignee: { email: string | null; name: string } | null }[];
    };
    expect(body.tasks[0].notes).toBeNull();
    expect(body.tasks[0].assignee?.name).toBe("Bob");
    expect(body.tasks[0].assignee?.email).toBeNull();
  });
});
