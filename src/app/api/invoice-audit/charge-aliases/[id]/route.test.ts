import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const guardInvoiceAuditSchemaMock = vi.fn();
const parseInvoiceAuditRecordIdMock = vi.fn();
const updateInvoiceChargeAliasForTenantMock = vi.fn();
const parseCanonicalTokensFromBodyMock = vi.fn();
const jsonFromInvoiceAuditErrorMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
}));

vi.mock("@/lib/demo-tenant", () => ({
  getDemoTenant: getDemoTenantMock,
}));

vi.mock("@/app/api/invoice-audit/_lib/guard-invoice-audit-schema", () => ({
  guardInvoiceAuditSchema: guardInvoiceAuditSchemaMock,
}));

vi.mock("@/lib/invoice-audit/invoice-audit-id", () => ({
  parseInvoiceAuditRecordId: parseInvoiceAuditRecordIdMock,
}));

vi.mock("@/lib/invoice-audit/invoice-charge-aliases", () => ({
  updateInvoiceChargeAliasForTenant: updateInvoiceChargeAliasForTenantMock,
  parseCanonicalTokensFromBody: parseCanonicalTokensFromBodyMock,
}));

vi.mock("@/app/api/invoice-audit/_lib/invoice-audit-api-error", () => ({
  jsonFromInvoiceAuditError: jsonFromInvoiceAuditErrorMock,
}));

describe("Invoice charge-alias by-id route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    guardInvoiceAuditSchemaMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    parseInvoiceAuditRecordIdMock.mockImplementation((raw: string) => (raw === "bad-id" ? null : raw));
    parseCanonicalTokensFromBodyMock.mockReturnValue(["OCEAN"]);
    jsonFromInvoiceAuditErrorMock.mockReturnValue(null);
  });

  it("returns parity error for invalid alias id", async () => {
    const { PATCH } = await import("./route");
    const request = new Request("http://localhost/api/invoice-audit/charge-aliases/bad-id", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pattern: "Ocean" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "bad-id" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid alias id." });
  });

  it("returns parity error for empty patch payload", async () => {
    const { PATCH } = await import("./route");
    const request = new Request("http://localhost/api/invoice-audit/charge-aliases/alias-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "alias-1" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "No updatable fields supplied." });
  });

  it("updates alias and returns alias shape", async () => {
    updateInvoiceChargeAliasForTenantMock.mockResolvedValue({
      id: "alias-1",
      name: "Ocean",
      pattern: "Ocean",
      canonicalTokens: ["OCEAN"],
      targetKind: null,
      priority: 1,
      active: true,
      createdAt: new Date("2026-04-20T00:00:00.000Z"),
      updatedAt: new Date("2026-04-20T00:00:00.000Z"),
    });
    const { PATCH } = await import("./route");
    const request = new Request("http://localhost/api/invoice-audit/charge-aliases/alias-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ priority: 1 }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "alias-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      alias: expect.objectContaining({
        id: "alias-1",
        priority: 1,
      }),
    });
  });
});
