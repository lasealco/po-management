import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import { buildOutboundDesadvSnapshotV1, type OutboundDesadvPrismaRow } from "./outbound-desadv-export";

const warehouse = {
  code: "WH1",
  name: "Main DC",
  addressLine1: "1 Dock Rd",
  city: "Chicago",
  region: "IL",
  countryCode: "US",
};

function baseOrder(over: Partial<OutboundDesadvPrismaRow> = {}): OutboundDesadvPrismaRow {
  return {
    id: "out-id",
    outboundNo: "OB-99",
    status: "PACKED",
    customerRef: "PO-1",
    asnReference: "ASN-77",
    requestedShipDate: new Date("2026-05-01T12:00:00.000Z"),
    shipToName: "Buyer Inc",
    shipToLine1: "99 Ship St",
    shipToCity: "Boston",
    shipToCountryCode: "US",
    carrierTrackingNo: null,
    carrierLabelAdapterId: null,
    carrierLabelPurchasedAt: null,
    warehouse,
    crmAccount: { id: "crm1", name: "Buyer Inc", legalName: "Buyer Incorporated" },
    sourceCrmQuote: { quoteNumber: "Q-100", title: "Spring quote" },
    lines: [
      {
        lineNo: 1,
        quantity: new Prisma.Decimal(10),
        packedQty: new Prisma.Decimal(10),
        shippedQty: new Prisma.Decimal(0),
        product: {
          id: "p1",
          sku: "SKU-A",
          productCode: "CODE-A",
          name: "Widget",
        },
      },
    ],
    ...over,
  };
}

describe("outbound-desadv-export", () => {
  const tenant = {
    name: "3PL Tenant",
    legalName: "3PL Tenant LLC",
    addressLine1: "HQ",
    addressCity: "NYC",
    addressRegion: "NY",
    addressPostalCode: "10001",
    addressCountryCode: "US",
  };
  const at = new Date("2026-05-02T15:00:00.000Z");

  it("uses packed quantities when status is PACKED", () => {
    const snap = buildOutboundDesadvSnapshotV1(baseOrder(), tenant, at);
    expect(snap.lines[0]?.dispatchedQty).toBe("10");
    expect(snap.lines[0]?.quantityBasis).toBe("PACKED");
    expect(snap.totals.sumDispatchedQty).toBe("10");
    expect(snap.outboundOrder.asnReference).toBe("ASN-77");
    expect(snap.parties.billToCustomer?.legalName).toBe("Buyer Incorporated");
  });

  it("uses shipped quantities when status is SHIPPED", () => {
    const snap = buildOutboundDesadvSnapshotV1(
      baseOrder({
        status: "SHIPPED",
        lines: [
          {
            lineNo: 1,
            quantity: new Prisma.Decimal(10),
            packedQty: new Prisma.Decimal(10),
            shippedQty: new Prisma.Decimal(10),
            product: { id: "p1", sku: "SKU-A", productCode: "CODE-A", name: "Widget" },
          },
        ],
      }),
      tenant,
      at,
    );
    expect(snap.lines[0]?.quantityBasis).toBe("SHIPPED");
    expect(snap.lines[0]?.dispatchedQty).toBe("10");
  });

  it("includes carrier tracking when present", () => {
    const snap = buildOutboundDesadvSnapshotV1(
      baseOrder({ carrierTrackingNo: "1Z999", carrierLabelAdapterId: "DEMO_PARCEL" }),
      tenant,
      at,
    );
    expect(snap.outboundOrder.carrierTrackingNo).toBe("1Z999");
  });
});
