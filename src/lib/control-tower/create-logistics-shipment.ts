import { Prisma, type TransportMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import { applyCtMilestonePack, milestonePackMatchesTransportMode } from "./milestone-templates";
import { writeCtAudit } from "./audit";

export type CreateLogisticsShipmentLine = {
  orderItemId: string;
  quantityShipped: string;
};

export type CreateLogisticsShipmentInput = {
  tenantId: string;
  actorUserId: string;
  orderId?: string | null;
  lines?: CreateLogisticsShipmentLine[];
  unlinkedOrder?: {
    referenceNo?: string | null;
    shipperName?: string | null;
    consigneeName?: string | null;
    requestedDeliveryDate?: Date | null;
  } | null;
  shipmentNo?: string | null;
  shippedAt?: Date | null;
  carrier?: string | null;
  trackingNo?: string | null;
  transportMode: TransportMode;
  notes?: string | null;
  booking?: {
    bookingNo?: string | null;
    serviceLevel?: string | null;
    originCode?: string | null;
    destinationCode?: string | null;
    etd?: Date | null;
    eta?: Date | null;
    latestEta?: Date | null;
  } | null;
  /** Optional template apply after booking exists (same rules as apply_ct_milestone_pack). */
  milestonePackId?: string | null;
};

function parsePositiveQty(raw: string): Prisma.Decimal {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Each line needs a positive quantityShipped.");
  }
  return new Prisma.Decimal(String(n));
}

/**
 * Creates a shipment from an existing PO for internal / Control Tower users (forwarder data not integrated).
 * Does not post supplier ASN milestones.
 */
export async function createLogisticsShipment(
  input: CreateLogisticsShipmentInput,
): Promise<{ shipmentId: string; milestonePackWarning?: string }> {
  const {
    tenantId,
    actorUserId,
    orderId,
    lines: providedLines,
    unlinkedOrder,
    transportMode,
    milestonePackId,
  } = input;
  const lines = Array.isArray(providedLines) ? providedLines : [];

  const shippedAt =
    input.shippedAt && !Number.isNaN(input.shippedAt.getTime()) ? input.shippedAt : new Date();

  const pack = milestonePackId?.trim() || null;
  if (pack && !milestonePackMatchesTransportMode(pack, transportMode)) {
    throw new Error("Milestone pack does not match the selected transport mode.");
  }

  const effectiveOrderId = orderId?.trim() || null;

  let resolvedOrderId: string;
  let resolvedLineRefs: Array<{ orderItemId: string; quantityShipped: Prisma.Decimal }>;

  if (effectiveOrderId) {
    if (!lines.length) {
      throw new Error("At least one order line with quantity is required.");
    }
    const order = await prisma.purchaseOrder.findFirst({
      where: { id: effectiveOrderId, tenantId },
      select: {
        id: true,
        items: { select: { id: true, lineNo: true, quantity: true } },
      },
    });
    if (!order) {
      throw new Error("Order not found.");
    }
    const itemById = new Map(order.items.map((i) => [i.id, i]));
    const seen = new Set<string>();
    resolvedLineRefs = lines.map((line) => {
      if (!itemById.has(line.orderItemId)) {
        throw new Error(`Unknown orderItemId: ${line.orderItemId}`);
      }
      if (seen.has(line.orderItemId)) {
        throw new Error(`Duplicate orderItemId: ${line.orderItemId}`);
      }
      seen.add(line.orderItemId);
      return {
        orderItemId: line.orderItemId,
        quantityShipped: parsePositiveQty(line.quantityShipped),
      };
    });
    resolvedOrderId = order.id;
  } else {
    const defaultWorkflow = await prisma.workflow.findFirst({
      where: { tenantId, isDefault: true },
      select: { id: true },
    });
    if (!defaultWorkflow) {
      throw new Error("No default workflow found. Create a default workflow before unlinked shipments.");
    }
    const startStatus = await prisma.workflowStatus.findFirst({
      where: { workflowId: defaultWorkflow.id, isStart: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    if (!startStatus) {
      throw new Error("Default workflow has no start status.");
    }

    const makeRef = () => {
      const stamp = Date.now().toString().slice(-8);
      const rand = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      return `EXP-${stamp}-${rand}`;
    };
    let orderNumber = makeRef();
    for (let i = 0; i < 5; i += 1) {
      const exists = await prisma.purchaseOrder.findFirst({
        where: { tenantId, orderNumber },
        select: { id: true },
      });
      if (!exists) break;
      orderNumber = makeRef();
    }

    const refNo = unlinkedOrder?.referenceNo?.trim() || orderNumber;
    const consignee = unlinkedOrder?.consigneeName?.trim() || null;
    const shipper = unlinkedOrder?.shipperName?.trim() || null;
    const requestedDeliveryDate =
      unlinkedOrder?.requestedDeliveryDate && !Number.isNaN(unlinkedOrder.requestedDeliveryDate.getTime())
        ? unlinkedOrder.requestedDeliveryDate
        : null;

    const createdOrder = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        workflowId: defaultWorkflow.id,
        statusId: startStatus.id,
        requesterId: actorUserId,
        orderNumber,
        title: `Ad-hoc export shipment ${refNo}`,
        currency: "USD",
        subtotal: new Prisma.Decimal("0.00"),
        taxAmount: new Prisma.Decimal("0.00"),
        totalAmount: new Prisma.Decimal("0.00"),
        buyerReference: refNo,
        shipToName: consignee,
        internalNotes: [shipper ? `Shipper: ${shipper}` : null, "Auto-created for shipment without linked PO."]
          .filter(Boolean)
          .join("\n"),
        requestedDeliveryDate,
        items: {
          create: {
            lineNo: 1,
            description: "Manual logistics shipment line",
            quantity: new Prisma.Decimal("1.000"),
            unitPrice: new Prisma.Decimal("0.0000"),
            lineTotal: new Prisma.Decimal("0.00"),
          },
        },
      },
      select: { id: true, items: { select: { id: true }, take: 1 } },
    });
    const fallbackItemId = createdOrder.items[0]?.id;
    if (!fallbackItemId) {
      throw new Error("Could not create placeholder order item for unlinked shipment.");
    }
    resolvedOrderId = createdOrder.id;
    resolvedLineRefs = [
      {
        orderItemId: fallbackItemId,
        quantityShipped: new Prisma.Decimal("1"),
      },
    ];
  }

  const shipmentId = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        orderId: resolvedOrderId,
        shipmentNo: input.shipmentNo?.trim() || null,
        shippedAt,
        status: "BOOKED",
        carrier: input.carrier?.trim() || null,
        trackingNo: input.trackingNo?.trim() || null,
        transportMode,
        notes: input.notes?.trim() || null,
        createdById: actorUserId,
        items: {
          create: resolvedLineRefs.map((line) => ({
            orderItemId: line.orderItemId,
            quantityShipped: line.quantityShipped,
          })),
        },
      },
      select: { id: true },
    });

    const b = input.booking;
    await tx.shipmentBooking.create({
      data: {
        shipmentId: created.id,
        status: "DRAFT",
        bookingNo: b?.bookingNo?.trim() || null,
        serviceLevel: b?.serviceLevel?.trim() || null,
        mode: transportMode,
        originCode: b?.originCode?.trim() || null,
        destinationCode: b?.destinationCode?.trim() || null,
        etd: b?.etd ?? null,
        eta: b?.eta ?? null,
        latestEta: b?.latestEta ?? null,
        createdById: actorUserId,
        updatedById: actorUserId,
      },
    });

    return created.id;
  });

  await writeCtAudit({
    tenantId,
    shipmentId,
    entityType: "Shipment",
    entityId: shipmentId,
    action: "create_logistics_shipment",
    actorUserId,
    payload: { orderId: resolvedOrderId, lineCount: resolvedLineRefs.length, milestonePackId: pack },
  });

  let milestonePackWarning: string | undefined;
  if (pack) {
    try {
      await applyCtMilestonePack({
        tenantId,
        shipmentId,
        actorUserId,
        packId: pack,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      milestonePackWarning = `Milestone template was not applied: ${msg}`;
    }
  }

  return { shipmentId, milestonePackWarning };
}
