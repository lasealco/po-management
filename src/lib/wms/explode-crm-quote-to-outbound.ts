import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { assertOutboundSourceQuoteAttachable } from "./crm-account-link";
import { resolveQuoteLineCommercialPricing } from "./cpq-contract-pricing";

export type QuoteExplosionRowStatus = "ok" | "missing_sku" | "unknown_sku" | "sku_not_in_scope";

export type QuoteExplosionPreviewRow = {
  quoteLineId: string;
  description: string;
  quantity: string;
  inventorySku: string | null;
  status: QuoteExplosionRowStatus;
  productId: string | null;
  productLabel: string | null;
  /** BF-22 — contracted unit (`CrmQuoteLine.unitPrice`). */
  contractUnitPrice: string;
  listUnitPrice: string | null;
  unitPriceDelta: string | null;
  extendedContract: string;
  extendedList: string | null;
  priceTierLabel: string | null;
};

export type QuoteExplosionPreview = {
  outboundOrderId: string;
  outboundNo: string;
  sourceQuoteId: string;
  quoteLineCount: number;
  rows: QuoteExplosionPreviewRow[];
  ready: boolean;
};

export function normalizeQuoteInventorySku(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  return t ? t : null;
}

function productLabel(p: { name: string; sku: string | null; productCode: string | null }): string {
  const bits = [p.productCode, p.sku, p.name].filter(Boolean);
  return bits.length ? bits.join(" · ") : p.name;
}

/**
 * Preview or apply CRM quote lines → `OutboundOrderLine` for an outbound with `sourceCrmQuoteId`.
 * Requires outbound visibility (`outboundScope`) and optional product-division filter (`productScope`).
 */
export async function explodeCrmQuoteToOutbound(params: {
  tenantId: string;
  actorId: string;
  outboundOrderId: string;
  outboundScope: Prisma.OutboundOrderWhereInput;
  productScope: Prisma.ProductWhereInput | undefined;
  confirm: boolean;
}): Promise<
  | { ok: false; status: number; error: string }
  | { ok: true; preview: QuoteExplosionPreview; applied: boolean; createdLineCount?: number }
> {
  const { tenantId, actorId, outboundOrderId, outboundScope, productScope, confirm } = params;

  const order = await prisma.outboundOrder.findFirst({
    where: { id: outboundOrderId, tenantId, AND: outboundScope },
    select: {
      id: true,
      outboundNo: true,
      status: true,
      sourceCrmQuoteId: true,
      crmAccountId: true,
      lines: { select: { id: true, lineNo: true } },
    },
  });

  if (!order) {
    return { ok: false, status: 404, error: "Outbound order not found." };
  }

  if (order.status === "PACKED" || order.status === "SHIPPED" || order.status === "CANCELLED") {
    return {
      ok: false,
      status: 400,
      error: "Cannot explode quote lines after pack, when shipped, or when cancelled.",
    };
  }

  if (!order.sourceCrmQuoteId) {
    return { ok: false, status: 400, error: "Outbound has no source CRM quote (BF-10)." };
  }

  if (!order.crmAccountId) {
    return { ok: false, status: 400, error: "Outbound needs a bill-to CRM account for quote explosion." };
  }

  const quoteGate = await assertOutboundSourceQuoteAttachable(
    tenantId,
    actorId,
    order.sourceCrmQuoteId,
    order.crmAccountId,
  );
  if (!quoteGate.ok) {
    return { ok: false, status: quoteGate.status, error: quoteGate.error };
  }

  if (order.lines.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "Outbound already has lines. Explosion applies only to orders with no lines.",
    };
  }

  const quoteLines = await prisma.crmQuoteLine.findMany({
    where: { quoteId: order.sourceCrmQuoteId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      description: true,
      quantity: true,
      inventorySku: true,
      unitPrice: true,
      listUnitPrice: true,
      priceTierLabel: true,
    },
  });

  const rows: QuoteExplosionPreviewRow[] = [];
  const resolved: Array<{
    quoteLineId: string;
    productId: string;
    quantity: Prisma.Decimal;
    commercial: ReturnType<typeof resolveQuoteLineCommercialPricing>;
  }> = [];

  for (const ql of quoteLines) {
    const pricing = resolveQuoteLineCommercialPricing({
      quantity: ql.quantity,
      unitPrice: ql.unitPrice,
      listUnitPrice: ql.listUnitPrice,
      priceTierLabel: ql.priceTierLabel,
    });
    const sku = normalizeQuoteInventorySku(ql.inventorySku);
    const qtyStr = ql.quantity.toString();
    const priceSlice = {
      contractUnitPrice: pricing.contractUnitPrice,
      listUnitPrice: pricing.listUnitPrice,
      unitPriceDelta: pricing.unitDelta,
      extendedContract: pricing.extendedContract,
      extendedList: pricing.extendedList,
      priceTierLabel: pricing.tierLabel,
    };
    if (!sku) {
      rows.push({
        quoteLineId: ql.id,
        description: ql.description,
        quantity: qtyStr,
        inventorySku: null,
        status: "missing_sku",
        productId: null,
        productLabel: null,
        ...priceSlice,
      });
      continue;
    }

    const baseWhere: Prisma.ProductWhereInput = { tenantId, sku };
    const scopedWhere: Prisma.ProductWhereInput = productScope
      ? { AND: [baseWhere, productScope] }
      : baseWhere;

    const product = await prisma.product.findFirst({
      where: scopedWhere,
      select: { id: true, name: true, sku: true, productCode: true },
    });

    if (!product) {
      const anySku = await prisma.product.findFirst({
        where: baseWhere,
        select: { id: true },
      });
      const rowStatus: QuoteExplosionRowStatus = anySku ? "sku_not_in_scope" : "unknown_sku";
      rows.push({
        quoteLineId: ql.id,
        description: ql.description,
        quantity: qtyStr,
        inventorySku: sku,
        status: rowStatus,
        productId: null,
        productLabel: null,
        ...priceSlice,
      });
      continue;
    }

    rows.push({
      quoteLineId: ql.id,
      description: ql.description,
      quantity: qtyStr,
      inventorySku: sku,
      status: "ok",
      productId: product.id,
      productLabel: productLabel(product),
      ...priceSlice,
    });
    resolved.push({
      quoteLineId: ql.id,
      productId: product.id,
      quantity: ql.quantity,
      commercial: pricing,
    });
  }

  const ready = rows.length > 0 && rows.every((r) => r.status === "ok");

  const preview: QuoteExplosionPreview = {
    outboundOrderId: order.id,
    outboundNo: order.outboundNo,
    sourceQuoteId: order.sourceCrmQuoteId,
    quoteLineCount: quoteLines.length,
    rows,
    ready,
  };

  if (!confirm) {
    return { ok: true, preview, applied: false };
  }

  if (!ready) {
    return {
      ok: false,
      status: 400,
      error: "Quote explosion blocked: fix SKU mappings on CRM quote lines, then preview again.",
    };
  }

  if (quoteLines.length === 0) {
    return { ok: false, status: 400, error: "CRM quote has no lines to explode." };
  }

  let lineNo = 0;
  await prisma.$transaction(async (tx) => {
    for (const r of resolved) {
      lineNo += 1;
      await tx.outboundOrderLine.create({
        data: {
          tenantId,
          outboundOrderId: order.id,
          lineNo,
          productId: r.productId,
          quantity: r.quantity,
          commercialUnitPrice: new Prisma.Decimal(r.commercial.contractUnitPrice),
          commercialListUnitPrice: r.commercial.listUnitPrice
            ? new Prisma.Decimal(r.commercial.listUnitPrice)
            : null,
          commercialPriceTierLabel: r.commercial.tierLabel,
          commercialExtendedAmount: new Prisma.Decimal(r.commercial.extendedContract),
        },
      });
    }
    await tx.ctAuditLog.create({
      data: {
        tenantId,
        entityType: "OUTBOUND_ORDER",
        entityId: order.id,
        action: "outbound_quote_lines_exploded",
        payload: {
          outboundNo: order.outboundNo,
          sourceQuoteId: order.sourceCrmQuoteId,
          createdLineCount: resolved.length,
          commercialSnapshots: true,
        },
        actorUserId: actorId,
      },
    });
  });

  return { ok: true, preview, applied: true, createdLineCount: resolved.length };
}
