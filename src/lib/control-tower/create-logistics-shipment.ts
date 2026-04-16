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
  orderId: string;
  lines: CreateLogisticsShipmentLine[];
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
    lines,
    transportMode,
    milestonePackId,
  } = input;

  if (!lines.length) {
    throw new Error("At least one order line with quantity is required.");
  }

  const order = await prisma.purchaseOrder.findFirst({
    where: { id: orderId, tenantId },
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
  for (const line of lines) {
    if (!itemById.has(line.orderItemId)) {
      throw new Error(`Unknown orderItemId: ${line.orderItemId}`);
    }
    if (seen.has(line.orderItemId)) {
      throw new Error(`Duplicate orderItemId: ${line.orderItemId}`);
    }
    seen.add(line.orderItemId);
    parsePositiveQty(line.quantityShipped);
  }

  const shippedAt =
    input.shippedAt && !Number.isNaN(input.shippedAt.getTime()) ? input.shippedAt : new Date();

  const pack = milestonePackId?.trim() || null;
  if (pack && !milestonePackMatchesTransportMode(pack, transportMode)) {
    throw new Error("Milestone pack does not match the selected transport mode.");
  }

  const shipmentId = await prisma.$transaction(async (tx) => {
    const created = await tx.shipment.create({
      data: {
        orderId: order.id,
        shipmentNo: input.shipmentNo?.trim() || null,
        shippedAt,
        status: "BOOKED",
        carrier: input.carrier?.trim() || null,
        trackingNo: input.trackingNo?.trim() || null,
        transportMode,
        notes: input.notes?.trim() || null,
        createdById: actorUserId,
        items: {
          create: lines.map((line) => ({
            orderItemId: line.orderItemId,
            quantityShipped: parsePositiveQty(line.quantityShipped),
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
    payload: { orderId: order.id, lineCount: lines.length, milestonePackId: pack },
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
