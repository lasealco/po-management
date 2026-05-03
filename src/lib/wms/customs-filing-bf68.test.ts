import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

import { buildCustomsFilingExportV1, type CustomsFilingPrismaRow } from "./customs-filing-bf68";
import type { TenantDesadvPartyRow } from "./outbound-desadv-export";

const tenant: TenantDesadvPartyRow = {
  name: "Shipper Co",
  legalName: "Shipper Co LLC",
  addressLine1: "1 Export Way",
  addressCity: "Chicago",
  addressRegion: "IL",
  addressPostalCode: "60601",
  addressCountryCode: "US",
};

function baseOrder(over: Partial<CustomsFilingPrismaRow> = {}): CustomsFilingPrismaRow {
  const line = {
    lineNo: 1,
    quantity: new Prisma.Decimal(10),
    packedQty: new Prisma.Decimal(10),
    shippedQty: new Prisma.Decimal(0),
    commercialUnitPrice: new Prisma.Decimal("12.50"),
    commercialExtendedAmount: new Prisma.Decimal("125.00"),
    product: {
      id: "p1",
      sku: "SKU-1",
      productCode: "PC-1",
      name: "Widget",
      description: "A widget",
      hsCode: "85171200",
      isDangerousGoods: false,
      dangerousGoodsClass: null,
      unNumber: null,
      properShippingName: null,
    },
  };
  return {
    id: "oid",
    outboundNo: "OB-EXP",
    status: "PACKED",
    customerRef: "CUST-PO-1",
    asnReference: null,
    requestedShipDate: new Date("2026-06-15T00:00:00.000Z"),
    shipToName: "Buyer EU",
    shipToLine1: "2 Hafenstrasse",
    shipToCity: "Hamburg",
    shipToCountryCode: "DE",
    carrierTrackingNo: "1ZTRACK",
    warehouse: {
      code: "WH-1",
      name: "Chicago DC",
      addressLine1: "9 Dock Rd",
      city: "Chicago",
      region: "IL",
      countryCode: "US",
    },
    crmAccount: { id: "crm1", name: "Buyer EU GmbH", legalName: "Buyer EU GmbH" },
    sourceCrmQuote: { quoteNumber: "Q-9", title: "EU order" },
    lines: [line],
    ...over,
  };
}

describe("customs-filing-bf68", () => {
  it("buildCustomsFilingExportV1 emits bf68.v1 with HS and commercial totals", () => {
    const snap = buildCustomsFilingExportV1(baseOrder(), tenant, new Date("2026-06-20T10:00:00.000Z"));
    expect(snap.schemaVersion).toBe("bf68.v1");
    expect(snap.profile).toBe("CUSTOMS_FILING_HANDOFF_STUB_V1");
    expect(snap.lines[0].hsCode).toBe("85171200");
    expect(snap.lines[0].quantityBasis).toBe("PACKED");
    expect(snap.totals.sumCommercialExtendedAmount).toBe("125");
    expect(snap.filingStub.destinationCountryCode).toBe("DE");
    expect(snap.filingStub.originCountryCode).toBe("US");
    expect(snap.parties.exporter.name).toBe("Shipper Co");
    expect(snap.shipment.carrierTrackingNo).toBe("1ZTRACK");
  });

  it("uses SHIPPED qty basis and clears sum when any line lacks commercial amount", () => {
    const row: CustomsFilingPrismaRow = {
      ...baseOrder(),
      status: "SHIPPED",
      lines: [
        {
          lineNo: 1,
          quantity: new Prisma.Decimal(10),
          packedQty: new Prisma.Decimal(10),
          shippedQty: new Prisma.Decimal(8),
          commercialUnitPrice: new Prisma.Decimal(1),
          commercialExtendedAmount: new Prisma.Decimal(8),
          product: {
            id: "p1",
            sku: "SKU-1",
            productCode: "PC-1",
            name: "Widget",
            description: null,
            hsCode: "85171200",
            isDangerousGoods: false,
            dangerousGoodsClass: null,
            unNumber: null,
            properShippingName: null,
          },
        },
        {
          lineNo: 2,
          quantity: new Prisma.Decimal(5),
          packedQty: new Prisma.Decimal(5),
          shippedQty: new Prisma.Decimal(5),
          commercialUnitPrice: null,
          commercialExtendedAmount: null,
          product: {
            id: "p2",
            sku: "SKU-2",
            productCode: "PC-2",
            name: "Gadget",
            description: null,
            hsCode: null,
            isDangerousGoods: true,
            dangerousGoodsClass: "3",
            unNumber: "UN1993",
            properShippingName: "Flammable liquid, nos",
          },
        },
      ],
    };
    const snap = buildCustomsFilingExportV1(row, tenant, new Date("2026-06-20T10:00:00.000Z"));
    expect(snap.lines[0].quantityBasis).toBe("SHIPPED");
    expect(snap.lines[0].quantity).toBe("8");
    expect(snap.lines[1].isDangerousGoods).toBe(true);
    expect(snap.lines[1].unNumber).toBe("UN1993");
    expect(snap.totals.sumCommercialExtendedAmount).toBeNull();
  });
});
