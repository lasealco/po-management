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
    wmsCommercialTermsJsonBf87: null,
    warehouse,
    crmAccount: { id: "crm1", name: "Buyer Inc", legalName: "Buyer Incorporated" },
    sourceCrmQuote: {
      id: "q1",
      quoteNumber: "Q-100",
      title: "Spring quote",
      currency: "USD",
      subtotal: new Prisma.Decimal("100.50"),
      validUntil: new Date("2026-06-01T00:00:00.000Z"),
    },
    lines: [
      {
        lineNo: 1,
        quantity: new Prisma.Decimal(10),
        packedQty: new Prisma.Decimal(10),
        shippedQty: new Prisma.Decimal(0),
        commercialUnitPrice: null,
        commercialListUnitPrice: null,
        commercialPriceTierLabel: null,
        commercialExtendedAmount: null,
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
    expect(snap.commercialTermsBf87.schemaVersion).toBe("bf87.v1");
    expect(snap.commercialTermsBf87.incoterm).toBeNull();
    expect(snap.commercialTermsBf87.sourceQuote?.id).toBe("q1");
    expect(snap.commercialTermsBf87.sourceQuote?.currency).toBe("USD");
    expect(snap.commercialTermsBf87.lineCommercials[0]?.lineNo).toBe(1);
    expect(snap.commercialTermsBf87.lineCommercials[0]?.commercialUnitPrice).toBeNull();
  });

  it("maps BF-87 JSON incoterm into export snapshot", () => {
    const snap = buildOutboundDesadvSnapshotV1(
      baseOrder({
        wmsCommercialTermsJsonBf87: { schemaVersion: "bf87.v1", incoterm: "DAP", paymentTermsDays: 30 },
      }),
      tenant,
      at,
    );
    expect(snap.commercialTermsBf87.incoterm).toBe("DAP");
    expect(snap.commercialTermsBf87.paymentTermsDays).toBe(30);
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
            commercialUnitPrice: null,
            commercialListUnitPrice: null,
            commercialPriceTierLabel: null,
            commercialExtendedAmount: null,
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
