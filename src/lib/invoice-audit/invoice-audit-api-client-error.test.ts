import { describe, expect, it } from "vitest";

import { formatInvoiceAuditApiError } from "@/lib/invoice-audit/invoice-audit-api-client-error";

describe("formatInvoiceAuditApiError", () => {
  it("joins error and migrationsHint for SCHEMA_NOT_READY", () => {
    expect(
      formatInvoiceAuditApiError(
        { code: "SCHEMA_NOT_READY", error: "Missing columns.", migrationsHint: "Run prisma migrate deploy." },
        503,
      ),
    ).toBe("Missing columns. Run prisma migrate deploy.");
  });

  it("uses default head when SCHEMA_NOT_READY omits error text", () => {
    expect(
      formatInvoiceAuditApiError({ code: "SCHEMA_NOT_READY", migrationsHint: "Hint only." }, 503),
    ).toBe("Invoice audit database is not ready. Hint only.");
  });

  it("falls back to HTTP status when no error field", () => {
    expect(formatInvoiceAuditApiError({}, 409)).toBe("Request failed (409)");
  });
});
