import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const guardInvoiceAuditSchemaMock = vi.fn();
const parseInvoiceAuditRecordIdMock = vi.fn();
const updateToleranceRuleForTenantMock = vi.fn();
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

vi.mock("@/lib/invoice-audit/tolerance-rules", () => ({
  updateToleranceRuleForTenant: updateToleranceRuleForTenantMock,
}));

vi.mock("@/app/api/invoice-audit/_lib/invoice-audit-api-error", () => ({
  jsonFromInvoiceAuditError: jsonFromInvoiceAuditErrorMock,
}));

describe("Invoice tolerance-rule by-id route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    guardInvoiceAuditSchemaMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    parseInvoiceAuditRecordIdMock.mockImplementation((raw: string) => (raw === "bad-id" ? null : raw));
    jsonFromInvoiceAuditErrorMock.mockReturnValue(null);
  });

  it("returns parity error for invalid rule id", async () => {
    const { PATCH } = await import("./route");
    const request = new Request("http://localhost/api/invoice-audit/tolerance-rules/bad-id", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Default" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "bad-id" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid rule id.", code: "BAD_INPUT" });
  });

  it("returns parity error when no updatable fields supplied", async () => {
    const { PATCH } = await import("./route");
    const request = new Request("http://localhost/api/invoice-audit/tolerance-rules/rule-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "rule-1" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "No updatable fields supplied.", code: "BAD_INPUT" });
  });

  it("updates rule and returns rule shape", async () => {
    updateToleranceRuleForTenantMock.mockResolvedValue({
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
    });

    const { PATCH } = await import("./route");
    const request = new Request("http://localhost/api/invoice-audit/tolerance-rules/rule-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "rule-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      rule: expect.objectContaining({
        id: "rule-1",
        name: "Default",
      }),
    });
  });
});
