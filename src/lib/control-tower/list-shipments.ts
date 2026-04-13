import type { Prisma, ShipmentStatus, TransportMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { controlTowerOrderWhere } from "./viewer";

export type ListShipmentsQuery = {
  status?: ShipmentStatus | "";
  mode?: TransportMode | "";
  q?: string;
  take?: number;
};

export async function listControlTowerShipments(params: {
  tenantId: string;
  isCustomer: boolean;
  query: ListShipmentsQuery;
}) {
  const { tenantId, isCustomer, query } = params;
  const take = Math.min(Math.max(query.take ?? 80, 1), 200);
  const orderWhere = controlTowerOrderWhere(isCustomer);

  const where: Prisma.ShipmentWhereInput = {
    order: { tenantId, ...orderWhere },
  };
  if (query.status) {
    where.status = query.status;
  }

  const ands: Prisma.ShipmentWhereInput[] = [];
  if (query.mode) {
    ands.push({
      OR: [
        { transportMode: query.mode },
        { booking: { is: { mode: query.mode } } },
      ],
    });
  }
  const q = query.q?.trim();
  if (q) {
    const contains = { contains: q, mode: "insensitive" as const };
    ands.push({
      OR: [
        { shipmentNo: contains },
        { trackingNo: contains },
        { carrier: contains },
        { order: { orderNumber: contains } },
        { ctReferences: { some: { refValue: contains } } },
      ],
    });
  }
  if (ands.length) {
    where.AND = ands;
  }

  const rows = await prisma.shipment.findMany({
    where,
    take,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      shipmentNo: true,
      status: true,
      transportMode: true,
      trackingNo: true,
      carrier: true,
      shippedAt: true,
      updatedAt: true,
      order: {
        select: {
          orderNumber: true,
          supplier: { select: { name: true } },
        },
      },
      booking: {
        select: {
          mode: true,
          originCode: true,
          destinationCode: true,
          etd: true,
          eta: true,
          latestEta: true,
        },
      },
      milestones: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { code: true, actualAt: true, plannedAt: true },
      },
    },
  });

  return rows.map((s) => ({
    id: s.id,
    shipmentNo: s.shipmentNo,
    status: s.status,
    transportMode: s.transportMode ?? s.booking?.mode ?? null,
    trackingNo: s.trackingNo,
    carrier: s.carrier,
    shippedAt: s.shippedAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    orderNumber: s.order.orderNumber,
    supplierName: s.order.supplier?.name ?? null,
    originCode: s.booking?.originCode ?? null,
    destinationCode: s.booking?.destinationCode ?? null,
    etd: s.booking?.etd?.toISOString() ?? null,
    eta: s.booking?.eta?.toISOString() ?? null,
    latestEta: s.booking?.latestEta?.toISOString() ?? null,
    latestMilestone: s.milestones[0]
      ? {
          code: s.milestones[0].code,
          hasActual: Boolean(s.milestones[0].actualAt),
        }
      : null,
  }));
}
