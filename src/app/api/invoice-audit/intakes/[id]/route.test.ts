import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getDemoTenantMock = vi.fn();
const guardInvoiceAuditSchemaMock = vi.fn();
const parseInvoiceAuditRecordIdMock = vi.fn();
const parseInvoiceIntakePatchBodyMock = vi.fn();
const getInvoiceIntakeForTenantMock = vi.fn();
const setInvoiceIntakeRawSourceNotesMock = vi.fn();
const setInvoiceIntakeReviewMock = vi.fn();
const patchInvoiceIntakeReviewAndAccountingMock = vi.fn();
const setInvoiceIntakeAccountingHandoffMock = vi.fn();
const jsonFromInvoiceAuditErrorMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
  getActorUserId: getActorUserIdMock,
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

vi.mock("@/lib/invoice-audit/invoice-intake-patch-parse", () => ({
  parseInvoiceIntakePatchBody: parseInvoiceIntakePatchBodyMock,
}));

vi.mock("@/lib/invoice-audit/invoice-intakes", () => ({
  getInvoiceIntakeForTenant: getInvoiceIntakeForTenantMock,
  setInvoiceIntakeRawSourceNotes: setInvoiceIntakeRawSourceNotesMock,
  setInvoiceIntakeReview: setInvoiceIntakeReviewMock,
  patchInvoiceIntakeReviewAndAccounting: patchInvoiceIntakeReviewAndAccountingMock,
  setInvoiceIntakeAccountingHandoff: setInvoiceIntakeAccountingHandoffMock,
}));

vi.mock("@/app/api/invoice-audit/_lib/invoice-audit-api-error", () => ({
  jsonFromInvoiceAuditError: jsonFromInvoiceAuditErrorMock,
}));

describe("Invoice intake by-id route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    guardInvoiceAuditSchemaMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    parseInvoiceAuditRecordIdMock.mockImplementation((raw: string) => (raw === "bad-id" ? null : raw));
    jsonFromInvoiceAuditErrorMock.mockReturnValue(null);
    parseInvoiceIntakePatchBodyMock.mockReturnValue({
      ok: true,
      value: {
        hasReview: false,
        hasAccounting: false,
        hasRawSourceNotes: true,
        rawSourceNotes: "ops note",
        approvedForAccounting: null,
      },
    });
  });

  it("GET returns parity error body for invalid intake id", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "bad-id" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid intake id.", code: "BAD_INPUT" });
  });

  it("PATCH returns parity error body for invalid JSON", async () => {
    const { PATCH } = await import("./route");
    const request = new Request("http://localhost/api/invoice-audit/intakes/intake-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "intake-1" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body.", code: "BAD_INPUT" });
  });

  it("PATCH updates notes and returns response shape parity", async () => {
    getInvoiceIntakeForTenantMock.mockResolvedValue({
      id: "intake-1",
      reviewDecision: null,
      reviewNote: null,
      reviewedByUserId: null,
      reviewedAt: null,
      approvedForAccounting: null,
      accountingApprovedByUserId: null,
      accountingApprovedAt: null,
      accountingApprovalNote: null,
      createdByUserId: "user-1",
      rawSourceNotes: "ops note",
    });

    const { PATCH } = await import("./route");
    const request = new Request("http://localhost/api/invoice-audit/intakes/intake-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rawSourceNotes: "ops note" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "intake-1" }) });

    expect(setInvoiceIntakeRawSourceNotesMock).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      invoiceIntakeId: "intake-1",
      rawSourceNotes: "ops note",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      intake: expect.objectContaining({
        id: "intake-1",
        rawSourceNotes: "ops note",
        createdByUserId: "user-1",
      }),
    });
  });
});
