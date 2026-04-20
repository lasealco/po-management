import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const getActorUserIdMock = vi.fn();
const getDemoTenantMock = vi.fn();
const guardInvoiceAuditSchemaMock = vi.fn();
const listInvoiceIntakesForTenantMock = vi.fn();
const createInvoiceIntakeWithLinesMock = vi.fn();
const parseInvoiceAuditRecordIdMock = vi.fn();
const jsonFromInvoiceAuditErrorMock = vi.fn();
const serializeInvoiceIntakeListRowMock = vi.fn();
const serializeBookingPricingSnapshotForIntakeApiMock = vi.fn();

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

vi.mock("@/lib/invoice-audit/invoice-intakes", () => ({
  listInvoiceIntakesForTenant: listInvoiceIntakesForTenantMock,
  createInvoiceIntakeWithLines: createInvoiceIntakeWithLinesMock,
}));

vi.mock("@/lib/invoice-audit/invoice-audit-id", () => ({
  parseInvoiceAuditRecordId: parseInvoiceAuditRecordIdMock,
}));

vi.mock("@/app/api/invoice-audit/_lib/invoice-audit-api-error", () => ({
  jsonFromInvoiceAuditError: jsonFromInvoiceAuditErrorMock,
}));

vi.mock("@/app/api/invoice-audit/_lib/serialize", () => ({
  serializeInvoiceIntakeListRow: serializeInvoiceIntakeListRowMock,
  serializeBookingPricingSnapshotForIntakeApi: serializeBookingPricingSnapshotForIntakeApiMock,
}));

describe("Invoice audit intakes route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
    guardInvoiceAuditSchemaMock.mockResolvedValue(null);
    getDemoTenantMock.mockResolvedValue({ id: "tenant-1" });
    getActorUserIdMock.mockResolvedValue("user-1");
    parseInvoiceAuditRecordIdMock.mockImplementation((raw: string) => raw);
    jsonFromInvoiceAuditErrorMock.mockReturnValue(null);
    serializeInvoiceIntakeListRowMock.mockImplementation((row: { id: string; status: string; currency: string }) => row);
    serializeBookingPricingSnapshotForIntakeApiMock.mockImplementation((snapshot: { id: string }) => snapshot);
  });

  it("GET returns serialized intake list", async () => {
    listInvoiceIntakesForTenantMock.mockResolvedValue([
      {
        id: "intake-1",
        status: "PARSED",
        externalInvoiceNo: null,
        vendorLabel: null,
        invoiceDate: null,
        currency: "USD",
        polCode: null,
        podCode: null,
        parseError: null,
        parseWarnings: [],
        auditRunError: null,
        lastAuditAt: null,
        rollupOutcome: null,
        greenLineCount: 0,
        amberLineCount: 0,
        redLineCount: 0,
        unknownLineCount: 0,
        reviewDecision: null,
        reviewNote: null,
        reviewedByUserId: null,
        reviewedAt: null,
        approvedForAccounting: null,
        accountingApprovedByUserId: null,
        accountingApprovedAt: null,
        accountingApprovalNote: null,
        createdByUserId: "user-1",
        receivedAt: new Date("2026-04-20T00:00:00.000Z"),
        bookingPricingSnapshot: { id: "snap-1", sourceType: "RFQ", currency: "USD" },
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      intakes: [
        expect.objectContaining({
          id: "intake-1",
          status: "PARSED",
          currency: "USD",
        }),
      ],
    });
  });

  it("POST returns parity error body for invalid JSON", async () => {
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/invoice-audit/intakes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body." });
  });

  it("POST creates intake and keeps amount/quantity as strings", async () => {
    createInvoiceIntakeWithLinesMock.mockResolvedValue({
      id: "intake-2",
      lines: [{ amount: 101.5, quantity: 2 }],
      bookingPricingSnapshot: {
        id: "snap-1",
        sourceType: "RFQ",
        sourceSummary: "quote",
        currency: "USD",
        totalEstimatedCost: 1000,
        frozenAt: new Date("2026-04-20T00:00:00.000Z"),
      },
    });

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/invoice-audit/intakes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookingPricingSnapshotId: "snap-1",
        lines: [{ lineNo: 1, rawDescription: "Ocean freight", currency: "USD", amount: "101.50", quantity: 2 }],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      intake: expect.objectContaining({
        id: "intake-2",
        lines: [expect.objectContaining({ amount: "101.5", quantity: "2" })],
      }),
    });
  });
});
