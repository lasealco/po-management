import { getProductTracePayload } from "@/lib/product-trace";
import { controlTowerShipmentAccessWhere, getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { prisma } from "@/lib/prisma";

import { extractProductQueryHint, type ProductPick } from "./operations-intent";
import { findProductCandidates } from "./operations-product-search";

export type AssistantImpactAnswer =
  | { kind: "defer" }
  | { kind: "no_hint"; message: string }
  | { kind: "not_found"; message: string }
  | { kind: "clarify"; message: string; options: ProductPick[] }
  | {
      kind: "answer";
      message: string;
      evidence: { label: string; href: string }[];
      quality: {
        mode: "deterministic";
        groundedBy: string[];
        limitations: string[];
        generatedAt: string;
      };
      playbook: {
        id: string;
        title: string;
        description: string;
        steps: Array<{
          id: string;
          label: string;
          description: string;
          status: "done" | "available" | "needs_review";
          actionIds?: string[];
        }>;
      };
      actions: Array<
        | { id: string; kind: "navigate"; label: string; description: string; href: string }
        | { id: string; kind: "copy_text"; label: string; description: string; text: string }
      >;
    };

function isImpactQuestion(text: string) {
  return /\b(impact|impacted|affected|risk|at risk|moving|customers?|sales orders?|purchase orders?|shipments?)\b/i.test(text);
}

function traceQuery(product: ProductPick) {
  return product.sku?.trim() || product.productCode?.trim() || product.id;
}

function numberFromString(value: string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function answerProductImpact(input: {
  tenantId: string;
  actorUserId: string;
  text: string;
  canWms: boolean;
  resolvedProductId?: string | null;
}): Promise<AssistantImpactAnswer> {
  const text = input.text.trim();
  const hint = input.resolvedProductId || extractProductQueryHint(text);
  if (!isImpactQuestion(text) && !input.resolvedProductId) {
    return { kind: "defer" };
  }
  if (!hint) {
    return {
      kind: "no_hint",
      message: "Name a product, SKU, or product code to check cross-object impact.",
    };
  }

  const candidates = await findProductCandidates(input.tenantId, hint);
  if (candidates.length === 0) {
    return { kind: "not_found", message: `No product matched "${hint}" in the catalog.` };
  }
  if (candidates.length > 1 && !input.resolvedProductId) {
    return { kind: "clarify", message: "Which product should I assess for impact?", options: candidates };
  }

  const product = candidates[0]!;
  const trace = await getProductTracePayload({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    query: traceQuery(product),
    includeInventory: input.canWms,
  });
  if (!trace.ok) {
    return { kind: "not_found", message: "Could not load product trace for this product." };
  }

  const ctx = await getControlTowerPortalContext(input.actorUserId);
  const shipmentAccess = await controlTowerShipmentAccessWhere(input.tenantId, ctx, input.actorUserId);
  const linkedShipments = await prisma.shipment.findMany({
    where: {
      AND: [
        shipmentAccess,
        {
          items: { some: { orderItem: { productId: product.id } } },
          salesOrderId: { not: null },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      shipmentNo: true,
      status: true,
      salesOrder: { select: { id: true, soNumber: true, status: true, customerName: true } },
    },
  });
  const salesOrders = Array.from(
    new Map(linkedShipments.flatMap((s) => (s.salesOrder ? [[s.salesOrder.id, s.salesOrder]] : []))).values(),
  );

  const inventoryRows = trace.data.inventory ?? [];
  const totalOnHand = inventoryRows.reduce((sum, row) => sum + numberFromString(row.onHandQty), 0);
  const totalAllocated = inventoryRows.reduce((sum, row) => sum + numberFromString(row.allocatedQty), 0);
  const available = Math.max(0, totalOnHand - totalAllocated);
  const openShipmentCount = trace.data.shipments.filter((s) =>
    ["BOOKING_DRAFT", "BOOKING_SUBMITTED", "BOOKED", "IN_TRANSIT", "SHIPPED", "VALIDATED"].includes(s.status),
  ).length;
  const supplierNames = Array.from(
    new Set(trace.data.purchaseOrderLines.map((line) => line.supplierName).filter((name): name is string => Boolean(name))),
  );

  const productLabel = product.productCode || product.sku || product.name;
  const message = [
    `Impact view for ${trace.data.product.name}${trace.data.product.sku ? ` (${trace.data.product.sku})` : ""}.`,
    input.canWms
      ? `Inventory: ${totalOnHand} on hand, ${totalAllocated} allocated, ${available} available across ${inventoryRows.length} warehouse location(s).`
      : "Inventory: WMS quantities are hidden because this viewer does not have WMS view access.",
    `Purchase exposure: ${trace.data.purchaseOrderLines.length} PO line(s) across ${supplierNames.length || "unknown"} supplier(s).`,
    `Execution exposure: ${trace.data.shipments.length} shipment(s), ${openShipmentCount} still active or in motion.`,
    `Customer exposure: ${salesOrders.length} linked sales order(s) found through shipments.`,
    salesOrders[0]
      ? `Top customer commitment: ${salesOrders[0].soNumber} (${salesOrders[0].status}) for ${salesOrders[0].customerName}.`
      : "No customer sales order is linked through shipments yet.",
  ].join("\n");

  return {
    kind: "answer",
    message,
    evidence: [
      { label: "Product record", href: `/products/${trace.data.product.id}` },
      { label: "Product trace", href: `/product-trace?q=${encodeURIComponent(traceQuery(product))}` },
      ...(input.canWms ? [{ label: "WMS workspace", href: "/wms" }] : []),
      ...trace.data.purchaseOrderLines.slice(0, 2).map((line) => ({
        label: `PO ${line.orderNumber}`,
        href: `/orders/${line.orderId}`,
      })),
      ...trace.data.shipments.slice(0, 2).map((shipment) => ({
        label: `Shipment ${shipment.shipmentNo ?? shipment.shipmentId}`,
        href: `/control-tower/shipments/${shipment.shipmentId}`,
      })),
      ...salesOrders.slice(0, 2).map((so) => ({
        label: `Sales order ${so.soNumber}`,
        href: `/sales-orders/${so.id}`,
      })),
    ],
    quality: {
      mode: "deterministic",
      groundedBy: ["Product", "ProductTrace", "PurchaseOrderItem", "Shipment", "InventoryBalance", "SalesOrder"],
      limitations: [
        ...(input.canWms ? [] : ["WMS inventory quantities are hidden for this viewer."]),
        ...(salesOrders.length === 0 ? ["No linked sales orders were found through shipments for this product."] : []),
      ],
      generatedAt: new Date().toISOString(),
    },
    playbook: {
      id: "product-impact-review",
      title: "Product impact review",
      description: "Review stock, supply, execution, and customer commitments before deciding the next move.",
      steps: [
        {
          id: "review-product-trace",
          label: "Review product trace",
          description: "Open the trace view to see PO, shipment, and inventory evidence together.",
          status: "available",
          actionIds: ["open-product-trace"],
        },
        {
          id: "review-supply",
          label: "Review supply exposure",
          description: "Check the latest purchase order line and supplier context.",
          status: trace.data.purchaseOrderLines.length > 0 ? "available" : "needs_review",
          actionIds: trace.data.purchaseOrderLines[0] ? ["open-latest-po"] : undefined,
        },
        {
          id: "review-execution",
          label: "Review shipment exposure",
          description: "Open the latest shipment to inspect route, milestones, alerts, and exceptions.",
          status: trace.data.shipments.length > 0 ? "available" : "needs_review",
          actionIds: trace.data.shipments[0] ? ["open-latest-shipment"] : undefined,
        },
        {
          id: "review-demand",
          label: "Review customer exposure",
          description: "Open a linked sales order if this product is tied to customer commitments.",
          status: salesOrders.length > 0 ? "available" : "needs_review",
          actionIds: salesOrders[0] ? ["open-latest-sales-order"] : undefined,
        },
        {
          id: "copy-summary",
          label: "Prepare impact summary",
          description: "Copy a concise internal summary for follow-up.",
          status: "available",
          actionIds: ["copy-impact-summary"],
        },
      ],
    },
    actions: [
      {
        id: "open-product-trace",
        kind: "navigate",
        label: "Open product trace",
        description: "Review all linked product movement evidence.",
        href: `/product-trace?q=${encodeURIComponent(traceQuery(product))}`,
      },
      ...(trace.data.purchaseOrderLines[0]
        ? [
            {
              id: "open-latest-po",
              kind: "navigate" as const,
              label: "Open latest PO",
              description: "Review supply-side commitment and supplier details.",
              href: `/orders/${trace.data.purchaseOrderLines[0].orderId}`,
            },
          ]
        : []),
      ...(trace.data.shipments[0]
        ? [
            {
              id: "open-latest-shipment",
              kind: "navigate" as const,
              label: "Open latest shipment",
              description: "Review execution status and any operational risk.",
              href: `/control-tower/shipments/${trace.data.shipments[0].shipmentId}`,
            },
          ]
        : []),
      ...(salesOrders[0]
        ? [
            {
              id: "open-latest-sales-order",
              kind: "navigate" as const,
              label: "Open linked sales order",
              description: "Review customer-facing exposure.",
              href: `/sales-orders/${salesOrders[0].id}`,
            },
          ]
        : []),
      {
        id: "copy-impact-summary",
        kind: "copy_text",
        label: "Copy impact summary",
        description: "Copy a concise impact summary for internal follow-up.",
        text: [
          `${productLabel} impact summary:`,
          input.canWms
            ? `Inventory available: ${available} (${totalOnHand} on hand, ${totalAllocated} allocated).`
            : "Inventory quantities hidden for this viewer.",
          `PO lines: ${trace.data.purchaseOrderLines.length}. Shipments: ${trace.data.shipments.length}. Linked sales orders: ${salesOrders.length}.`,
        ].join("\n"),
      },
    ],
  };
}
