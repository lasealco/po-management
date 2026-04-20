import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const guardInvoiceAuditSchemaMock = vi.fn();
const listInvoiceChargeAliasesForTenantMock = vi.fn();
const createInvoiceChargeAliasMock = vi.fn();
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

vi.mock("@/lib/invoice-audit/invoice-charge-aliases", () => ({
  listInvoiceChargeAliasesForTenant: listInvoiceChargeAliasesForTenantMock,
  createInvoiceChargeAlias: createInvoiceChargeAliasMock,
  parseCanonicalTokensFromBody: parseCanonicalTokensFromBodyMock,
}));

vi.mock("@/app/api/invoice-audit/_lib/invoice-audit-api-error", () => ({
  jsonFromInvoiceAuditError: jsonFromInvoiceAuditErrorMock,
}));

describe("Invoice charge-aliases route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    guardInvoiceAuditSchemaMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    parseCanonicalTokensFromBodyMock.mockReturnValue(["OCEAN"]);
    jsonFromInvoiceAuditErrorMock.mockReturnValue(null);
  });

  it("GET returns aliases array", async () => {
    listInvoiceChargeAliasesForTenantMock.mockResolvedValue([
      {
        id: "alias-1",
        pattern: "Ocean",
        canonicalTokens: ["OCEAN"],
        targetKind: null,
        priority: 0,
        active: true,
        createdAt: new Date("2026-04-20T00:00:00.000Z"),
        updatedAt: new Date("2026-04-20T00:00:00.000Z"),
      },
    ]);
    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      aliases: [expect.objectContaining({ id: "alias-1", pattern: "Ocean" })],
    });
  });

  it("POST returns parity error body for missing canonical tokens", async () => {
    parseCanonicalTokensFromBodyMock.mockReturnValue([]);
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/invoice-audit/charge-aliases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pattern: "Ocean" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "canonicalTokens is required (non-empty array or newline/comma-separated string).",
    });
  });
});
