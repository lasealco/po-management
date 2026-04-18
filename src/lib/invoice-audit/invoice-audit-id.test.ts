import { describe, expect, it } from "vitest";

import { parseInvoiceAuditRecordId } from "@/lib/invoice-audit/invoice-audit-id";

describe("parseInvoiceAuditRecordId", () => {
  it("accepts typical cuid-like ids", () => {
    expect(parseInvoiceAuditRecordId("clq1a2b3c4d5e6f7g8h9j0k1")).toBe("clq1a2b3c4d5e6f7g8h9j0k1");
    expect(parseInvoiceAuditRecordId("  Abcdefg123456789012345  ")).toBe("Abcdefg123456789012345");
  });

  it("rejects empty, too long, or non-alphanumeric ids", () => {
    expect(parseInvoiceAuditRecordId("")).toBeNull();
    expect(parseInvoiceAuditRecordId("   ")).toBeNull();
    expect(parseInvoiceAuditRecordId(null)).toBeNull();
    expect(parseInvoiceAuditRecordId("../etc/passwd")).toBeNull();
    expect(parseInvoiceAuditRecordId("a".repeat(41))).toBeNull();
    expect(parseInvoiceAuditRecordId("has-dashes")).toBeNull();
  });
});
