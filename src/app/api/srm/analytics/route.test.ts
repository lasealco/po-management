import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/srm/srm-analytics-aggregates", () => ({
  loadSrmOrderVolumeKpis: async () => ({
    from: "a",
    to: "b",
    srmKind: "product",
    totalOrders: 0,
    bySupplier: [],
    concentration: { top3OrderCountPct: 0, byCurrency: [] },
  }),
  loadSrmBookingSlaStats: async () => ({
    inRangeWithSent: 0,
    withConfirmation: 0,
    metSla: 0,
    missedSla: 0,
    indeterminate: 0,
    sample: [],
    isSparse: true,
    disclaimer: "test",
  }),
  loadSrmOperationalSignals: async () => ({
    suppliersInScope: 1,
    byApprovalStatus: { pending_approval: 0, approved: 1, rejected: 0 },
    onboardingTasksOpen: 0,
    onboardingTasksOverdue: 0,
  }),
}));

describe("GET /api/srm/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
  });

  it("returns 403 when org.suppliers view gate applies", async () => {
    const gate = new Response(null, { status: 403 });
    requireApiGrantMock.mockResolvedValueOnce(gate);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/srm/analytics"));
    expect(res).toBe(gate);
  });

  it("returns JSON when suppliers view ok and orders view ok", async () => {
    requireApiGrantMock.mockImplementation(async (resource: string) => {
      if (resource === "org.suppliers") return null;
      if (resource === "org.orders") return null;
      return new Response(null, { status: 403 });
    });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/srm/analytics?kind=product"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orderKpi: { totalOrders: number } | null; orderMetricsRequiresOrdersView: boolean };
    expect(body.orderMetricsRequiresOrdersView).toBe(false);
    expect(body.orderKpi).not.toBeNull();
  });

  it("hides order KPI when org.orders view is denied", async () => {
    const ordersDenied = new Response(null, { status: 403 });
    requireApiGrantMock.mockImplementation(async (resource: string) => {
      if (resource === "org.suppliers") return null;
      if (resource === "org.orders") return ordersDenied;
      return new Response(null, { status: 403 });
    });
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/srm/analytics?kind=product"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orderKpi: unknown; orderMetricsRequiresOrdersView: boolean };
    expect(body.orderMetricsRequiresOrdersView).toBe(true);
    expect(body.orderKpi).toBeNull();
  });
});
