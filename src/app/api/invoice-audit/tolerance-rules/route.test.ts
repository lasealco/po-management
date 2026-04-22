import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const guardInvoiceAuditSchemaMock = vi.fn();
const listToleranceRulesForTenantMock = vi.fn();
const createToleranceRuleMock = vi.fn();
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

vi.mock("@/lib/invoice-audit/tolerance-rules", () => ({
  listToleranceRulesForTenant: listToleranceRulesForTenantMock,
  createToleranceRule: createToleranceRuleMock,
}));

vi.mock("@/app/api/invoice-audit/_lib/invoice-audit-api-error", () => ({
  jsonFromInvoiceAuditError: jsonFromInvoiceAuditErrorMock,
}));

describe("Invoice tolerance-rules route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    guardInvoiceAuditSchemaMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    jsonFromInvoiceAuditErrorMock.mockReturnValue(null);
  });

  it("GET returns rules array", async () => {
    listToleranceRulesForTenantMock.mockResolvedValue([
      {
        id: "rule-1",
        name: "Default",
        priority: 0,
        active: true,
        amountAbsTolerance: null,
        percentTolerance: null,
        currencyScope: null,
        categoryScope: null,
        createdAt: new Date("2026-04-20T00:00:00.000Z"),
        updatedAt: new Date("2026-04-20T00:00:00.000Z"),
      },
    ]);
    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      rules: [expect.objectContaining({ id: "rule-1", name: "Default" })],
    });
  });

  it("POST returns parity error body when name missing", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/invoice-audit/tolerance-rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: " " }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "name is required.", code: "BAD_INPUT" });
  });
});
