import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getDemoTenantMock = vi.fn();
const crmTenantFilterMock = vi.fn();

const crmAccountFindManyMock = vi.fn();
const crmAccountCreateMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: getActorUserIdMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/lib/crm-scope", () => ({
  crmTenantFilter: crmTenantFilterMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    crmAccount: {
      findMany: crmAccountFindManyMock,
      create: crmAccountCreateMock,
    },
  },
}));

describe("CRM accounts route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    crmTenantFilterMock.mockResolvedValue({ tenantId: "tenant-1" });
  });

  it("GET returns 403 auth shape when actor is missing", async () => {
    getActorUserIdMock.mockResolvedValueOnce(null);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/crm/accounts"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "No active user." });
    expect(crmAccountFindManyMock).not.toHaveBeenCalled();
  });

  it("GET returns accounts array contract", async () => {
    const accountRow = {
      id: "acc-1",
      name: "Acme Co",
      legalName: "Acme Company",
      accountType: "CUSTOMER",
      lifecycle: "ACTIVE",
      industry: "Logistics",
      strategicFlag: false,
      ownerUserId: "user-1",
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      owner: { id: "user-1", name: "Alex", email: "alex@example.com" },
      _count: { contacts: 3, opportunities: 2 },
    };
    crmAccountFindManyMock.mockResolvedValueOnce([accountRow]);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/crm/accounts?q=acme"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      accounts: [
        expect.objectContaining({
          id: "acc-1",
          name: "Acme Co",
          ownerUserId: "user-1",
        }),
      ],
    });
    expect(crmAccountFindManyMock).toHaveBeenCalledTimes(1);
  });

  it("POST returns 400 with stable validation error shape", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/crm/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "name is required." });
    expect(crmAccountCreateMock).not.toHaveBeenCalled();
  });

  it("POST returns 201 with created account contract", async () => {
    crmAccountCreateMock.mockResolvedValueOnce({
      id: "acc-2",
      name: "Beta LLC",
      accountType: "PROSPECT",
      lifecycle: "ACTIVE",
      ownerUserId: "user-1",
    });
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/crm/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: " Beta LLC " }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      account: expect.objectContaining({
        id: "acc-2",
        name: "Beta LLC",
        ownerUserId: "user-1",
      }),
    });
  });
});
