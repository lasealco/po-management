import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiGrantMock = vi.fn();
const checkInvoiceAuditDatabaseSchemaMock = vi.fn();

vi.mock("@/lib/authz", () => ({
  requireApiGrant: requireApiGrantMock,
}));

vi.mock("@/lib/invoice-audit/invoice-audit-db-readiness", () => ({
  checkInvoiceAuditDatabaseSchema: checkInvoiceAuditDatabaseSchemaMock,
  INVOICE_AUDIT_MIGRATION_SEQUENCE_HINT: ["m1", "m2"],
}));

describe("Invoice readiness route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiGrantMock.mockResolvedValue(null);
  });

  it("passes refresh query as bypassCache=true", async () => {
    checkInvoiceAuditDatabaseSchemaMock.mockResolvedValue({
      ok: true,
      issues: [],
      appliedPrismaMigrations: ["m1"],
      missingPrismaMigrations: [],
      migrationHistoryNote: null,
    });

    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/invoice-audit/readiness?refresh=true"));

    expect(checkInvoiceAuditDatabaseSchemaMock).toHaveBeenCalledWith({ bypassCache: true });
  });

  it("returns 503 with expected body shape when readiness fails", async () => {
    checkInvoiceAuditDatabaseSchemaMock.mockResolvedValue({
      ok: false,
      issues: [{ key: "invoice_intakes", message: "missing table" }],
      appliedPrismaMigrations: [],
      missingPrismaMigrations: ["m1"],
      migrationHistoryNote: "run migrate",
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/invoice-audit/readiness"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      issues: [{ key: "invoice_intakes", message: "missing table" }],
      requiredMigrationsHint: ["m1", "m2"],
      appliedPrismaMigrations: [],
      missingPrismaMigrations: ["m1"],
      migrationHistoryNote: "run migrate",
    });
  });
});
