import { describe, expect, it } from "vitest";

import { substituteReceivingDispositionNoteTemplate } from "./receiving-disposition-template";

describe("substituteReceivingDispositionNoteTemplate", () => {
  it("replaces known tokens", () => {
    expect(
      substituteReceivingDispositionNoteTemplate(
        "Ln {{lineNo}} SKU {{productSku}} recv {{qtyReceived}}/{{qtyShipped}} ASN {{asnReference}} PO {{orderNumber}}",
        {
          lineNo: 3,
          qtyShipped: "10",
          qtyReceived: "10",
          productSku: "ABC",
          asnReference: "ASN-1",
          orderNumber: "PO-99",
        },
      ),
    ).toBe("Ln 3 SKU ABC recv 10/10 ASN ASN-1 PO PO-99");
  });

  it("truncates to variance note max length", () => {
    const long = "x".repeat(1200);
    const out = substituteReceivingDispositionNoteTemplate(long, {
      lineNo: 1,
      qtyShipped: "0",
      qtyReceived: "0",
      productSku: "",
      asnReference: "",
      orderNumber: "",
    });
    expect(out.length).toBe(1000);
  });
});
