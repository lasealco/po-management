import { describe, expect, it } from "vitest";

import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";

describe("InvoiceAuditError", () => {
  it("carries code for API mapping", () => {
    const e = new InvoiceAuditError("NOT_FOUND", "missing");
    expect(e.code).toBe("NOT_FOUND");
    expect(e.message).toBe("missing");
    expect(e.name).toBe("InvoiceAuditError");
  });
});
