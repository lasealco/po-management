import { describe, expect, it } from "vitest";

import { scoreImportAssistantDomainsFromRecords, topImportAssistantDomainGuess } from "./import-assistant-domain-infer";

describe("import assistant domain inference", () => {
  it("ranks invoicing when invoice vocabulary appears", () => {
    const top = topImportAssistantDomainGuess([{ invoiceNumber: "INV-1", chargeCode: "OCEAN" }]);
    expect(top).toBe("invoicing_charges");
  });

  it("ranks shipments when shipment vocabulary appears", () => {
    const top = topImportAssistantDomainGuess([{ shipmentId: "S1", containerNumber: "MSKU" }]);
    expect(top).toBe("shipments_visibility");
  });

  it("returns null when no signals", () => {
    expect(topImportAssistantDomainGuess([{ foo: "bar" }])).toBeNull();
  });

  it("scoreImportAssistantDomainsFromRecords sorts by score", () => {
    const s = scoreImportAssistantDomainsFromRecords([
      { invoiceNumber: "x", chargeCode: "y", tariffLine: "z" },
    ]);
    expect(s[0]!.id).toBe("invoicing_charges");
    expect(s[0]!.score).toBeGreaterThanOrEqual(s[1]!.score);
  });
});
