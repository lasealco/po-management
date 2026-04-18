import { describe, expect, it } from "vitest";

import { jsonFromInvoiceAuditError } from "@/app/api/invoice-audit/_lib/invoice-audit-api-error";
import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";

describe("jsonFromInvoiceAuditError", () => {
  it("returns 503 and migrationsHint for SCHEMA_NOT_READY", async () => {
    const res = jsonFromInvoiceAuditError(
      new InvoiceAuditError("SCHEMA_NOT_READY", "Missing invoice_intakes.approvedForAccounting."),
    );
    expect(res).not.toBeNull();
    const body = (await res!.json()) as { code: string; migrationsHint?: string };
    expect(res!.status).toBe(503);
    expect(body.code).toBe("SCHEMA_NOT_READY");
    expect(body.migrationsHint).toContain("migrate deploy");
  });
});
