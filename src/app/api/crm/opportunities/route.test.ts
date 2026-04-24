import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getDemoTenantMock = vi.fn();
const getCrmAccessScopeMock = vi.fn();

const crmOpportunityFindManyMock = vi.fn();
const crmOpportunityCreateMock = vi.fn();
const crmAccountFindFirstMock = vi.fn();

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
    crmOpportunity: {
      findMany: crmOpportunityFindManyMock,
      create: crmOpportunityCreateMock,
    },
    crmAccount: {
      findFirst: crmAccountFindFirstMock,
    },
  },
}));

describe("CRM opportunities route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    getCrmAccessScopeMock.mockResolvedValue({ mode: "tenant" });
  });

  it("GET returns opportunities array contract", async () => {
    crmOpportunityFindManyMock.mockResolvedValueOnce([
      {
        id: "opp-1",
        name: "Pilot lane pricing",
        stage: "QUALIFIED",
        probability: 40,
        estimatedRevenue: "15000",
        currency: "USD",
        closeDate: null,
        nextStep: null,
        nextStepDate: null,
        ownerUserId: "user-1",
        account: { id: "acc-1", name: "Acme" },
        owner: { id: "user-1", name: "Alex", email: "alex@example.com" },
      },
    ]);
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      opportunities: [
        expect.objectContaining({
          id: "opp-1",
          stage: "QUALIFIED",
          ownerUserId: "user-1",
        }),
      ],
    });
  });

  it("POST returns 400 for missing required fields", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/crm/opportunities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId: "acc-1" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "accountId and name are required.",
      code: "BAD_INPUT",
    });
    expect(crmOpportunityCreateMock).not.toHaveBeenCalled();
  });

  it("POST returns 404 when account lookup fails", async () => {
    crmAccountFindFirstMock.mockResolvedValueOnce(null);
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/crm/opportunities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId: "acc-missing", name: "New opportunity" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Account not found.", code: "NOT_FOUND" });
  });

  it("POST returns 201 with created opportunity contract", async () => {
    crmAccountFindFirstMock.mockResolvedValueOnce({ id: "acc-1" });
    crmOpportunityCreateMock.mockResolvedValueOnce({
      id: "opp-2",
      name: "Expansion",
      stage: "IDENTIFIED",
      accountId: "acc-1",
      ownerUserId: "user-1",
    });
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/crm/opportunities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountId: "acc-1", name: "Expansion" }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      opportunity: expect.objectContaining({
        id: "opp-2",
        accountId: "acc-1",
        ownerUserId: "user-1",
      }),
    });
  });
});
