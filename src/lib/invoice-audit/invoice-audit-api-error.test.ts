import { describe, expect, it } from "vitest";

import { jsonFromInvoiceAuditError } from "@/app/api/invoice-audit/_lib/invoice-audit-api-error";
import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";

describe("jsonFromInvoiceAuditError", () => {
  it("returns null for non-InvoiceAuditError values", () => {
    expect(jsonFromInvoiceAuditError(new Error("plain"))).toBeNull();
    expect(jsonFromInvoiceAuditError(undefined)).toBeNull();
  });

  it.each([
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["FORBIDDEN", 403],
    ["BAD_INPUT", 400],
  ] as const)("maps %s to status %s with error and code in body", async (code, expectedStatus) => {
    const res = jsonFromInvoiceAuditError(new InvoiceAuditError(code, "msg"));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(expectedStatus);
    const body = (await res!.json()) as { error: string; code: string; migrationsHint?: string };
    expect(body.error).toBe("msg");
    expect(body.code).toBe(code);
    expect(body.migrationsHint).toBeUndefined();
  });

  it("returns 503 and migrationsHint for SCHEMA_NOT_READY", async () => {
    const res = jsonFromInvoiceAuditError(
      new InvoiceAuditError("SCHEMA_NOT_READY", "Missing invoice_intakes.approvedForAccounting."),
    );
    expect(res).not.toBeNull();
    const body = (await res!.json()) as { error: string; code: string; migrationsHint?: string };
    expect(res!.status).toBe(503);
    expect(body.error).toContain("Missing");
    expect(body.code).toBe("SCHEMA_NOT_READY");
    expect(body.migrationsHint).toContain("migrate deploy");
    expect(body.migrationsHint).toMatch(/readiness/i);
  });
});
