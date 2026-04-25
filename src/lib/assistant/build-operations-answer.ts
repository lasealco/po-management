import { getProductTracePayload } from "@/lib/product-trace";
import type { ProductTracePayload } from "@/lib/product-trace";

import type { ProductPick } from "./operations-intent";

export type AssistantEvidenceLink = { label: string; href: string; kind: "product" | "product_trace" | "wms" | "shipment" | "po" };

export type BuildOperationsAnswerResult =
  | { kind: "not_found"; message: string; hint: string }
  | { kind: "answer"; message: string; evidence: AssistantEvidenceLink[]; payload: ProductTracePayload };

const encodeQ = (q: string) => encodeURIComponent(q);

function bestTraceQ(p: { sku: string | null; productCode: string | null; id: string }): string {
  return p.sku?.trim() || p.productCode?.trim() || p.id;
}

function buildNarrative(data: ProductTracePayload, canWms: boolean): string {
  const p = data.product;
  const label = [p.name, p.sku ? `(${p.sku})` : null].filter(Boolean).join(" ");
  const parts: string[] = [label];

  if (data.inventory && data.inventory.length > 0) {
    const lines = data.inventory.map((r) => {
      const on = Number(r.onHandQty);
      const alloc = Number(r.allocatedQty);
      const avail = Math.max(0, on - alloc);
      const avStr = Number.isFinite(avail) ? String(avail) : r.onHandQty;
      return `• ${r.warehouseName} (code ${r.warehouseCode ?? "—"}): on hand ${r.onHandQty}; allocated ${r.allocatedQty}; available ${avStr} ${p.unit ?? "units"}.`;
    });
    parts.push("Warehouse stock (inventory balances):", ...lines);
  } else if (data.inventoryOmittedReason === "no_wms_grant") {
    parts.push(
      "Stock: WMS read access is not granted, so on-hand from balances is hidden. Open Product trace or WMS in the app, or grant org.wms view for quantities here.",
    );
  } else {
    parts.push("Stock: no inventory balances in this tenant for this product (or WMS not populated).");
  }

  if (data.shipments.length > 0) {
    const s0 = data.shipments[0]!;
    parts.push(
      `In transit (latest by ship date): ${s0.shipmentNo ?? s0.shipmentId} — status ${s0.status}, mode ${s0.transportMode ?? "—"}, order ${s0.orderNumber}.`,
    );
  } else {
    parts.push("Shipments: no matching logistics rows for this product in your current scope.");
  }

  if (data.purchaseOrderLines.length > 0) {
    const l0 = data.purchaseOrderLines[0]!;
    parts.push(
      `Latest PO line: ${l0.orderNumber} line ${l0.lineNo} — ${l0.statusLabel}, qty ${l0.quantityOrdered} ${l0.uom ?? ""}`.trim(),
    );
  } else {
    parts.push("Purchase side: no purchase order lines in scope for this product yet.");
  }

  if (canWms) {
    parts.push("Use the evidence links for Product trace (full map) and WMS (bin detail when seeded).");
  } else {
    parts.push("Use the evidence link for Product trace (PO → shipment).");
  }

  return parts.join("\n\n");
}

function evidenceFromPayload(
  data: ProductTracePayload,
  canWms: boolean,
): AssistantEvidenceLink[] {
  const p = data.product;
  const q = bestTraceQ(p);
  const out: AssistantEvidenceLink[] = [
    {
      kind: "product",
      label: "Product record",
      href: `/products/${p.id}`,
    },
    {
      kind: "product_trace",
      label: "Product trace (map + detail)",
      href: `/product-trace?q=${encodeQ(q)}`,
    },
  ];
  if (canWms) {
    out.push({ kind: "wms", label: "WMS workspace", href: "/wms" });
  }
  if (data.shipments[0]) {
    out.push({
      kind: "shipment",
      label: `Shipment ${data.shipments[0].shipmentNo ?? "detail"}`,
      href: `/control-tower/shipments/${data.shipments[0].shipmentId}`,
    });
  }
  if (data.purchaseOrderLines[0]) {
    out.push({
      kind: "po",
      label: `PO ${data.purchaseOrderLines[0].orderNumber}`,
      href: `/orders/${data.purchaseOrderLines[0].orderId}`,
    });
  }
  return out;
}

export async function buildOperationsAnswer(input: {
  tenantId: string;
  actorUserId: string;
  product: ProductPick;
  canWms: boolean;
}): Promise<BuildOperationsAnswerResult> {
  const query = bestTraceQ(input.product);
  const res = await getProductTracePayload({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    query,
    includeInventory: input.canWms,
  });
  if (!res.ok) {
    return {
      kind: "not_found",
      message: "Could not load product trace (product may have been removed).",
      hint: query,
    };
  }
  const message = buildNarrative(res.data, input.canWms);
  const evidence = evidenceFromPayload(res.data, input.canWms);
  return { kind: "answer", message, evidence, payload: res.data };
}
