import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getDemoTenantMock = vi.fn();
const guardInvoiceAuditSchemaMock = vi.fn();
const parseInvoiceAuditRecordIdMock = vi.fn();
const runInvoiceAuditForIntakeMock = vi.fn();
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

vi.mock("@/lib/invoice-audit/invoice-intakes", () => ({
  runInvoiceAuditForIntake: runInvoiceAuditForIntakeMock,
}));

vi.mock("@/app/api/invoice-audit/_lib/invoice-audit-api-error", () => ({
  jsonFromInvoiceAuditError: jsonFromInvoiceAuditErrorMock,
}));

describe("Invoice intake run-audit route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    guardInvoiceAuditSchemaMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    parseInvoiceAuditRecordIdMock.mockImplementation((raw: string) => (raw === "bad" ? null : raw));
    jsonFromInvoiceAuditErrorMock.mockReturnValue(null);
  });

  it("returns parity error for invalid toleranceRuleId", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/invoice-audit/intakes/intake-1/run-audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toleranceRuleId: "bad" }),
    });
    const response = await POST(request, { params: Promise.resolve({ id: "intake-1" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid toleranceRuleId." });
  });

  it("returns audited intake shape on success", async () => {
    runInvoiceAuditForIntakeMock.mockResolvedValue({
      id: "intake-1",
      status: "AUDITED",
      rollupOutcome: "GREEN",
      greenLineCount: 1,
      amberLineCount: 0,
      redLineCount: 0,
      unknownLineCount: 0,
      auditRunError: null,
      lastAuditAt: new Date("2026-04-20T00:00:00.000Z"),
      lines: [],
      auditResults: [],
    });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/invoice-audit/intakes/intake-1/run-audit", {
      method: "POST",
    });
    const response = await POST(request, { params: Promise.resolve({ id: "intake-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      intake: expect.objectContaining({
        id: "intake-1",
        status: "AUDITED",
        rollupOutcome: "GREEN",
      }),
    });
  });
});
