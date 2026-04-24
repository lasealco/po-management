import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const userHasGlobalGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const getCrmAccessScopeMock = vi.fn();

const crmLeadFindFirstMock = vi.fn();
const crmAccountFindFirstMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: getActorUserIdMock,
  userHasGlobalGrant: userHasGlobalGrantMock,
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
    crmLead: {
      findFirst: crmLeadFindFirstMock,
    },
    crmAccount: {
      findFirst: crmAccountFindFirstMock,
    },
    $transaction: transactionMock,
  },
}));

describe("CRM lead conversion route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    requireApiGrantMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    userHasGlobalGrantMock.mockResolvedValue(false);
    getCrmAccessScopeMock.mockResolvedValue({ mode: "tenant" });
  });

  it("returns 400 parity error for invalid JSON payload", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/crm/leads/lead-1/convert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    const response = await POST(request, { params: Promise.resolve({ id: "lead-1" }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body.", code: "BAD_INPUT" });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("returns 404 contract when lead is missing", async () => {
    crmLeadFindFirstMock.mockResolvedValueOnce(null);
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/crm/leads/lead-404/convert", {
      method: "POST",
      body: "",
    });

    const response = await POST(request, { params: Promise.resolve({ id: "lead-404" }) });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Lead not found.", code: "NOT_FOUND" });
  });

  it("returns 403 contract when actor does not own lead", async () => {
    crmLeadFindFirstMock.mockResolvedValueOnce({
      id: "lead-1",
      tenantId: "tenant-1",
      ownerUserId: "other-user",
      status: "QUALIFIED",
    });
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/crm/leads/lead-1/convert", {
      method: "POST",
      body: "",
    });

    const response = await POST(request, { params: Promise.resolve({ id: "lead-1" }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You can only convert leads you own.",
      code: "FORBIDDEN",
    });
  });

  it("returns 201 with conversion payload contract", async () => {
    crmLeadFindFirstMock.mockResolvedValueOnce({
      id: "lead-1",
      tenantId: "tenant-1",
      ownerUserId: "user-1",
      status: "QUALIFIED",
      companyName: "Acme",
      contactFirstName: "A",
      contactLastName: "B",
      contactEmail: "ab@example.com",
      contactPhone: null,
      qualificationNotes: "ready",
    });
    transactionMock.mockResolvedValueOnce({
      account: { id: "acc-1", name: "Acme" },
      contact: { id: "con-1", firstName: "A", lastName: "B" },
      opportunity: { id: "opp-1", name: "Acme — New opportunity" },
      linkedExistingAccount: false,
    });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/crm/leads/lead-1/convert", {
      method: "POST",
      body: "",
    });

    const response = await POST(request, { params: Promise.resolve({ id: "lead-1" }) });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      account: expect.objectContaining({ id: "acc-1", name: "Acme" }),
      contact: expect.objectContaining({ id: "con-1" }),
      opportunity: expect.objectContaining({ id: "opp-1" }),
      linkedExistingAccount: false,
    });
  });
});
