import { describe, expect, it } from "vitest";

import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";
import {
  coerceChargeAliasTargetKind,
  parseCanonicalTokensFromBody,
} from "@/lib/invoice-audit/invoice-charge-aliases";

describe("parseCanonicalTokensFromBody", () => {
  it("returns null when omitted", () => {
    expect(parseCanonicalTokensFromBody(undefined)).toBeNull();
  });
  it("parses arrays and strings", () => {
    expect(parseCanonicalTokensFromBody([" a ", "b"])).toEqual(["a", "b"]);
    expect(parseCanonicalTokensFromBody("a, b\nc")).toEqual(["a", "b", "c"]);
  });
});

describe("coerceChargeAliasTargetKind", () => {
  it("accepts allowed kinds", () => {
    expect(coerceChargeAliasTargetKind("contract_charge")).toBe("CONTRACT_CHARGE");
  });
  it("rejects unknown", () => {
    expect(() => coerceChargeAliasTargetKind("TRUCK")).toThrow(InvoiceAuditError);
  });
});
