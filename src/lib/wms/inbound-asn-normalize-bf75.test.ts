import { describe, expect, it } from "vitest";

import { BF75_SCHEMA_VERSION, normalizeInboundAsnEnvelopeBf75 } from "./inbound-asn-normalize-bf75";

describe("inbound-asn-normalize-bf75", () => {
  it("normalizes bf59_wrap envelope", () => {
    const r = normalizeInboundAsnEnvelopeBf75({
      partnerId: "carrier-x",
      rawEnvelope: {
        externalAsnId: " ASN-1 ",
        asnReference: "REF",
        expectedReceiveAt: "2026-06-01T10:00:00.000Z",
        lines: [{ lineNo: 1, productSku: "SKU-A", quantityExpected: 4 }],
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.schemaVersion).toBe(BF75_SCHEMA_VERSION);
    expect(r.doc.partnerId).toBe("carrier-x");
    expect(r.doc.externalAsnId).toBe("ASN-1");
    expect(r.doc.asnReference).toBe("REF");
    expect(r.doc.expectedReceiveAt).toBe("2026-06-01T10:00:00.000Z");
    expect(r.doc.lines).toHaveLength(1);
    expect(r.doc.lines[0]!.quantityExpected).toBe("4.000");
  });

  it("normalizes compact_items_v1", () => {
    const r = normalizeInboundAsnEnvelopeBf75({
      partnerId: "edi-demo",
      envelopeHint: "compact_items_v1",
      rawEnvelope: {
        asnId: "COMPACT-9",
        asnRef: "856REF",
        eta: "2026-05-15T12:00:00Z",
        items: [{ sku: "Z", qty: 2.5, line: 10 }],
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.externalAsnId).toBe("COMPACT-9");
    expect(r.doc.asnReference).toBe("856REF");
    expect(r.doc.lines[0]!.lineNo).toBe(10);
    expect(r.doc.lines[0]!.quantityExpected).toBe("2.500");
  });

  it("rejects unknown envelope without hint", () => {
    const r = normalizeInboundAsnEnvelopeBf75({
      partnerId: "p",
      rawEnvelope: { foo: 1 },
    });
    expect(r.ok).toBe(false);
  });
});
