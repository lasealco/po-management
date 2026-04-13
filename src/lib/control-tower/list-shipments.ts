import type { Prisma, ShipmentStatus, TransportMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  controlTowerShipmentScopeWhere,
  type ControlTowerPortalContext,
} from "./viewer";

export type ListShipmentsQuery = {
  status?: ShipmentStatus | "";
  mode?: TransportMode | "";
  q?: string;
  take?: number;
};

export async function listControlTowerShipments(params: {
  tenantId: string;
  ctx: ControlTowerPortalContext;
  query: ListShipmentsQuery;
}) {
  const { tenantId, ctx, query } = params;
  const take = Math.min(Math.max(query.take ?? 80, 1), 200);
  const scope = controlTowerShipmentScopeWhere(tenantId, ctx);

  const where: Prisma.ShipmentWhereInput = {
    ...scope,
    ...(query.status ? { status: query.status } : {}),
  };

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
        { ctContainers: { some: { containerNumber: contains } } },
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
      customerCrmAccountId: true,
      customerCrmAccount: {
        select: { name: true },
      },
      order: {
        select: {
          id: true,
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
      ctLegs: {
        orderBy: { legNo: "asc" },
        select: {
          legNo: true,
          originCode: true,
          destinationCode: true,
          transportMode: true,
          plannedEtd: true,
          plannedEta: true,
          actualAtd: true,
          actualAta: true,
        },
      },
    },
  });

  return rows.map((s) => {
    const firstLeg = s.ctLegs[0];
    const lastLeg = s.ctLegs[s.ctLegs.length - 1];
    const phases = s.ctLegs.map((leg) => {
      if (leg.actualAta) return "Arrived";
      if (leg.actualAtd) return "Departed";
      if (leg.plannedEtd || leg.plannedEta) return "Planned";
      return "Draft";
    });
    const routeProgressPct =
      s.ctLegs.length === 0
        ? null
        : Math.round(
            (phases.reduce((sum, p) => {
              if (p === "Arrived") return sum + 1;
              if (p === "Departed") return sum + 0.6;
              if (p === "Planned") return sum + 0.2;
              return sum;
            }, 0) /
              s.ctLegs.length) *
              100,
          );
    const nextLegIdx = phases.findIndex((p) => p !== "Arrived");
    const nextLeg = nextLegIdx >= 0 ? s.ctLegs[nextLegIdx] : null;
    const nextAction = !s.ctLegs.length
      ? null
      : nextLegIdx === -1
        ? "Route complete"
        : phases[nextLegIdx] === "Draft"
          ? `Plan leg ${nextLeg?.legNo ?? "?"}`
          : phases[nextLegIdx] === "Planned"
            ? `Mark departure leg ${nextLeg?.legNo ?? "?"}`
            : `Record arrival leg ${nextLeg?.legNo ?? "?"}`;
    return {
    id: s.id,
    shipmentNo: s.shipmentNo,
    status: s.status,
    transportMode: s.transportMode ?? s.booking?.mode ?? firstLeg?.transportMode ?? null,
    trackingNo: s.trackingNo,
    carrier: s.carrier,
    shippedAt: s.shippedAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    customerCrmAccountId: s.customerCrmAccountId,
    customerCrmAccountName: s.customerCrmAccount?.name ?? null,
    orderId: s.order.id,
    orderNumber: s.order.orderNumber,
    supplierName: s.order.supplier?.name ?? null,
    originCode: s.booking?.originCode ?? firstLeg?.originCode ?? null,
    destinationCode: s.booking?.destinationCode ?? lastLeg?.destinationCode ?? null,
    etd: s.booking?.etd?.toISOString() ?? null,
    eta: s.booking?.eta?.toISOString() ?? lastLeg?.plannedEta?.toISOString() ?? null,
    latestEta: s.booking?.latestEta?.toISOString() ?? null,
    routeProgressPct,
    nextAction,
    latestMilestone: s.milestones[0]
      ? {
          code: s.milestones[0].code,
          hasActual: Boolean(s.milestones[0].actualAt),
        }
      : null,
    };
  });
}
