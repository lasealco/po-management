import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getDemoTenantMock = vi.fn();
const getCrmAccessScopeMock = vi.fn();

const crmLeadCountMock = vi.fn();
const crmAccountCountMock = vi.fn();
const crmOpportunityCountMock = vi.fn();
const crmActivityCountMock = vi.fn();
const crmQuoteCountMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: getActorUserIdMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/crm-scope", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/crm-scope")>();
  return { ...mod, getCrmAccessScope: getCrmAccessScopeMock };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmLead: { count: crmLeadCountMock },
    crmAccount: { count: crmAccountCountMock },
    crmOpportunity: { count: crmOpportunityCountMock },
    crmActivity: { count: crmActivityCountMock },
    crmQuote: { count: crmQuoteCountMock },
  },
}));

describe("CRM summary route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    getCrmAccessScopeMock.mockResolvedValue({ mode: "tenant" });
  });

  it("returns 403 auth shape when no active actor", async () => {
    getActorUserIdMock.mockResolvedValueOnce(null);
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "No active user.", code: "FORBIDDEN" });
  });

  it("returns stable aggregate summary shape", async () => {
    crmLeadCountMock.mockResolvedValueOnce(4);
    crmAccountCountMock.mockResolvedValueOnce(3);
    crmOpportunityCountMock.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    crmActivityCountMock.mockResolvedValueOnce(6).mockResolvedValueOnce(2);
    crmQuoteCountMock.mockResolvedValueOnce(5);
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      leads: 4,
      accounts: 3,
      openOpportunities: 2,
      openActivities: 6,
      openQuotes: 5,
      staleOpportunities: 1,
      overdueActivities: 2,
    });
  });
});
