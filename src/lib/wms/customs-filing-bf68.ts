/**
 * BF-68 — vendor-neutral customs / AES-style filing handoff JSON (broker tooling; not government-signed).
 */

import { Prisma } from "@prisma/client";

import type { TenantDesadvPartyRow } from "./outbound-desadv-export";

export const CUSTOMS_FILING_SCHEMA_VERSION = "bf68.v1" as const;

export type CustomsFilingProductRow = {
  id: string;
  sku: string | null;
  productCode: string | null;
  name: string;
  description: string | null;
  hsCode: string | null;
  isDangerousGoods: boolean;
  dangerousGoodsClass: string | null;
  unNumber: string | null;
  properShippingName: string | null;
};

export type CustomsFilingPrismaRow = {
  id: string;
  outboundNo: string;
  status: string;
  customerRef: string | null;
  asnReference: string | null;
  requestedShipDate: Date | null;
  shipToName: string | null;
  shipToLine1: string | null;
  shipToCity: string | null;
  shipToCountryCode: string | null;
  carrierTrackingNo: string | null;
  warehouse: {
    code: string | null;
    name: string;
    addressLine1: string | null;
    city: string | null;
    region: string | null;
    countryCode: string | null;
  };
  crmAccount: { id: string; name: string; legalName: string | null } | null;
  sourceCrmQuote: { quoteNumber: string | null; title: string } | null;
  lines: Array<{
    lineNo: number;
    quantity: Prisma.Decimal;
    packedQty: Prisma.Decimal;
    shippedQty: Prisma.Decimal;
    commercialUnitPrice: Prisma.Decimal | null;
    commercialExtendedAmount: Prisma.Decimal | null;
    product: CustomsFilingProductRow;
  }>;
};

export type CustomsFilingExportV1 = {
  schemaVersion: typeof CUSTOMS_FILING_SCHEMA_VERSION;
  profile: "CUSTOMS_FILING_HANDOFF_STUB_V1";
  generatedAt: string;
  methodology: string;
  shipment: {
    outboundOrderId: string;
    outboundNo: string;
    status: string;
    customerRef: string | null;
    asnReference: string | null;
    requestedShipDate: string | null;
    carrierTrackingNo: string | null;
    exportSiteCode: string | null;
    exportSiteName: string;
  };
  parties: {
    exporter: {
      name: string;
      legalName: string | null;
      addressLine1: string | null;
      addressCity: string | null;
      addressRegion: string | null;
      addressPostalCode: string | null;
      addressCountryCode: string | null;
    };
    originatingLocation: {
      code: string | null;
      name: string;
      addressLine1: string | null;
      city: string | null;
      region: string | null;
      countryCode: string | null;
    };
    consignee: {
      name: string | null;
      line1: string | null;
      city: string | null;
      countryCode: string | null;
    };
    billToParty: {
      id: string;
      name: string;
      legalName: string | null;
    } | null;
  };
  commercialReference: {
    quoteNumber: string | null;
    title: string;
  } | null;
  lines: Array<{
    lineNo: number;
    productId: string;
    sku: string | null;
    productCode: string | null;
    description: string;
    hsCode: string | null;
    quantity: string;
    quantityUom: "EA";
    quantityBasis: "PACKED" | "SHIPPED";
    commercialUnitPrice: string | null;
    commercialExtendedAmount: string | null;
    statisticalValueNote: string;
    isDangerousGoods: boolean;
    dangerousGoodsClass: string | null;
    unNumber: string | null;
    properShippingName: string | null;
  }>;
  totals: {
    lineCount: number;
    sumQuantity: string;
    sumCommercialExtendedAmount: string | null;
  };
  filingStub: {
    exportTypeCode: "HANDOFF_STUB";
    destinationCountryCode: string | null;
    originCountryCode: string | null;
    disclaimer: string;
  };
};

/** Requires outbound status PACKED or SHIPPED and non-empty lines (caller validates). */
export function buildCustomsFilingExportV1(
  order: CustomsFilingPrismaRow,
  tenant: TenantDesadvPartyRow,
  generatedAt: Date,
): CustomsFilingExportV1 {
  const qtyBasis: "PACKED" | "SHIPPED" = order.status === "SHIPPED" ? "SHIPPED" : "PACKED";
  let sumQty = new Prisma.Decimal(0);
  let sumCommercialTotal = new Prisma.Decimal(0);
  let commercialLineCount = 0;
  const totalLineCount = order.lines.length;

  const lines = order.lines.map((l) => {
    const rawQty = qtyBasis === "SHIPPED" ? l.shippedQty : l.packedQty;
    sumQty = sumQty.plus(rawQty);
    const ext = l.commercialExtendedAmount;
    if (ext != null) {
      sumCommercialTotal = sumCommercialTotal.plus(ext);
      commercialLineCount += 1;
    }
    const desc =
      l.product.description && l.product.description.trim()
        ? l.product.description.trim().slice(0, 512)
        : l.product.name;
    return {
      lineNo: l.lineNo,
      productId: l.product.id,
      sku: l.product.sku,
      productCode: l.product.productCode,
      description: desc,
      hsCode: l.product.hsCode?.trim() || null,
      quantity: rawQty.toString(),
      quantityUom: "EA" as const,
      quantityBasis: qtyBasis,
      commercialUnitPrice: l.commercialUnitPrice?.toString() ?? null,
      commercialExtendedAmount: ext?.toString() ?? null,
      statisticalValueNote:
        ext != null
          ? "commercialExtendedAmount from OutboundOrderLine (CPQ snapshot — verify for customs valuation)."
          : "No commercialExtendedAmount on line — broker must supply value / INCOTERM context.",
      isDangerousGoods: l.product.isDangerousGoods,
      dangerousGoodsClass: l.product.dangerousGoodsClass,
      unNumber: l.product.unNumber,
      properShippingName: l.product.properShippingName,
    };
  });

  const originCountry =
    order.warehouse.countryCode?.trim() || tenant.addressCountryCode?.trim() || null;

  const sumCommercialExtendedAmount =
    totalLineCount > 0 && commercialLineCount === totalLineCount
      ? sumCommercialTotal.toString()
      : null;

  return {
    schemaVersion: CUSTOMS_FILING_SCHEMA_VERSION,
    profile: "CUSTOMS_FILING_HANDOFF_STUB_V1",
    generatedAt: generatedAt.toISOString(),
    methodology:
      "BF-68 minimal handoff: parties + HS/dangerous-goods hints from Product + optional CPQ line values — not a filed AES/EEI; signing and broker APIs are out of scope.",
    shipment: {
      outboundOrderId: order.id,
      outboundNo: order.outboundNo,
      status: order.status,
      customerRef: order.customerRef,
      asnReference: order.asnReference,
      requestedShipDate: order.requestedShipDate?.toISOString() ?? null,
      carrierTrackingNo: order.carrierTrackingNo,
      exportSiteCode: order.warehouse.code,
      exportSiteName: order.warehouse.name,
    },
    parties: {
      exporter: {
        name: tenant.name,
        legalName: tenant.legalName,
        addressLine1: tenant.addressLine1,
        addressCity: tenant.addressCity,
        addressRegion: tenant.addressRegion,
        addressPostalCode: tenant.addressPostalCode,
        addressCountryCode: tenant.addressCountryCode,
      },
      originatingLocation: {
        code: order.warehouse.code,
        name: order.warehouse.name,
        addressLine1: order.warehouse.addressLine1,
        city: order.warehouse.city,
        region: order.warehouse.region,
        countryCode: order.warehouse.countryCode,
      },
      consignee: {
        name: order.shipToName,
        line1: order.shipToLine1,
        city: order.shipToCity,
        countryCode: order.shipToCountryCode,
      },
      billToParty: order.crmAccount
        ? {
            id: order.crmAccount.id,
            name: order.crmAccount.name,
            legalName: order.crmAccount.legalName,
          }
        : null,
    },
    commercialReference: order.sourceCrmQuote
      ? {
          quoteNumber: order.sourceCrmQuote.quoteNumber,
          title: order.sourceCrmQuote.title,
        }
      : null,
    lines,
    totals: {
      lineCount: lines.length,
      sumQuantity: sumQty.toString(),
      sumCommercialExtendedAmount,
    },
    filingStub: {
      exportTypeCode: "HANDOFF_STUB",
      destinationCountryCode: order.shipToCountryCode?.trim() || null,
      originCountryCode: originCountry,
      disclaimer:
        "This JSON is an internal handoff stub only. It is not transmitted to customs authorities and must not be used as proof of export compliance.",
    },
  };
}
