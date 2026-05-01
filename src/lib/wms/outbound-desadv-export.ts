/**
 * BF-40 — EDIFACT DESADV-inspired JSON stub for outbound ship notices (not a certified EDI encoder).
 */

import { Prisma } from "@prisma/client";

export type OutboundDesadvSnapshotV1 = {
  schemaVersion: 1;
  profile: "EDIFACT_DESADV_INSPIRED_JSON_STUB_V1";
  generatedAt: string;
  outboundOrder: {
    id: string;
    outboundNo: string;
    status: string;
    customerRef: string | null;
    asnReference: string | null;
    requestedShipDate: string | null;
    carrierTrackingNo: string | null;
    carrierLabelAdapterId: string | null;
    carrierLabelPurchasedAt: string | null;
  };
  parties: {
    dispatchingWarehouse: {
      code: string | null;
      name: string;
      addressLine1: string | null;
      city: string | null;
      region: string | null;
      countryCode: string | null;
    };
    supplierOrganization: {
      name: string;
      legalName: string | null;
      addressLine1: string | null;
      addressCity: string | null;
      addressRegion: string | null;
      addressPostalCode: string | null;
      addressCountryCode: string | null;
    };
    shipTo: {
      name: string | null;
      line1: string | null;
      city: string | null;
      countryCode: string | null;
    };
    billToCustomer: {
      id: string;
      name: string;
      legalName: string | null;
    } | null;
  };
  sourceCommercialDocument: {
    quoteNumber: string | null;
    title: string;
  } | null;
  lines: Array<{
    lineNo: number;
    productId: string;
    sku: string | null;
    productCode: string | null;
    productName: string;
    orderedQty: string;
    dispatchedQty: string;
    quantityBasis: "PACKED" | "SHIPPED";
    uom: "EA";
  }>;
  totals: {
    lineCount: number;
    sumDispatchedQty: string;
  };
};

export type OutboundDesadvPrismaRow = {
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
  carrierLabelAdapterId: string | null;
  carrierLabelPurchasedAt: Date | null;
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
    product: {
      id: string;
      sku: string | null;
      productCode: string | null;
      name: string;
    };
  }>;
};

export type TenantDesadvPartyRow = {
  name: string;
  legalName: string | null;
  addressLine1: string | null;
  addressCity: string | null;
  addressRegion: string | null;
  addressPostalCode: string | null;
  addressCountryCode: string | null;
};

/** Requires outbound status PACKED or SHIPPED (caller validates). */
export function buildOutboundDesadvSnapshotV1(
  order: OutboundDesadvPrismaRow,
  tenant: TenantDesadvPartyRow,
  generatedAt: Date,
): OutboundDesadvSnapshotV1 {
  const qtyBasis: "PACKED" | "SHIPPED" = order.status === "SHIPPED" ? "SHIPPED" : "PACKED";
  let sum = new Prisma.Decimal(0);
  const lines = order.lines.map((l) => {
    const raw = qtyBasis === "SHIPPED" ? l.shippedQty : l.packedQty;
    const dispatchedQty = raw.toString();
    sum = sum.plus(raw);
    return {
      lineNo: l.lineNo,
      productId: l.product.id,
      sku: l.product.sku,
      productCode: l.product.productCode,
      productName: l.product.name,
      orderedQty: l.quantity.toString(),
      dispatchedQty,
      quantityBasis: qtyBasis,
      uom: "EA" as const,
    };
  });

  return {
    schemaVersion: 1,
    profile: "EDIFACT_DESADV_INSPIRED_JSON_STUB_V1",
    generatedAt: generatedAt.toISOString(),
    outboundOrder: {
      id: order.id,
      outboundNo: order.outboundNo,
      status: order.status,
      customerRef: order.customerRef,
      asnReference: order.asnReference,
      requestedShipDate: order.requestedShipDate?.toISOString() ?? null,
      carrierTrackingNo: order.carrierTrackingNo,
      carrierLabelAdapterId: order.carrierLabelAdapterId,
      carrierLabelPurchasedAt: order.carrierLabelPurchasedAt?.toISOString() ?? null,
    },
    parties: {
      dispatchingWarehouse: {
        code: order.warehouse.code,
        name: order.warehouse.name,
        addressLine1: order.warehouse.addressLine1,
        city: order.warehouse.city,
        region: order.warehouse.region,
        countryCode: order.warehouse.countryCode,
      },
      supplierOrganization: {
        name: tenant.name,
        legalName: tenant.legalName,
        addressLine1: tenant.addressLine1,
        addressCity: tenant.addressCity,
        addressRegion: tenant.addressRegion,
        addressPostalCode: tenant.addressPostalCode,
        addressCountryCode: tenant.addressCountryCode,
      },
      shipTo: {
        name: order.shipToName,
        line1: order.shipToLine1,
        city: order.shipToCity,
        countryCode: order.shipToCountryCode,
      },
      billToCustomer: order.crmAccount
        ? {
            id: order.crmAccount.id,
            name: order.crmAccount.name,
            legalName: order.crmAccount.legalName,
          }
        : null,
    },
    sourceCommercialDocument: order.sourceCrmQuote
      ? {
          quoteNumber: order.sourceCrmQuote.quoteNumber,
          title: order.sourceCrmQuote.title,
        }
      : null,
    lines,
    totals: {
      lineCount: lines.length,
      sumDispatchedQty: sum.toString(),
    },
  };
}
