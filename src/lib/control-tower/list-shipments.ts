import type { Prisma, ShipmentStatus, TransportMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  controlTowerShipmentScopeWhere,
  type ControlTowerPortalContext,
} from "./viewer";

const TERMINAL_SHIPMENT: Array<"DELIVERED" | "RECEIVED"> = ["DELIVERED", "RECEIVED"];

const ROUTE_ACTION_PREFIXES = ["Plan leg", "Mark departure", "Record arrival", "Route complete"] as const;

export type ListShipmentsQuery = {
  status?: ShipmentStatus | "";
  mode?: TransportMode | "";
  q?: string;
  take?: number;
  /** Booking ETA or latest ETA before now; excludes terminal shipments. */
  onlyOverdueEta?: boolean;
  /** Prefix of derived `nextAction` (e.g. `Plan leg`); applied after fetch with overscan. */
  routeActionPrefix?: (typeof ROUTE_ACTION_PREFIXES)[number] | "";
  /** Shipments with at least one open alert or open exception assigned to this user (internal lists). */
  dispatchOwnerUserId?: string;
};

const listSelectCore = {
  id: true,
  shipmentNo: true,
  status: true,
  transportMode: true,
  trackingNo: true,
  carrier: true,
  shippedAt: true,
  updatedAt: true,
  receivedAt: true,
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
  ctReferences: {
    where: {
      refType: {
        in: ["SHIPPER", "CONSIGNEE", "QTY", "WEIGHT_KG", "CBM"] as const,
      },
    },
    select: { refType: true, refValue: true },
    take: 12,
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
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { code: true, actualAt: true, plannedAt: true },
  },
  ctLegs: {
    orderBy: { legNo: "asc" as const },
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
} satisfies Prisma.ShipmentSelect;

const listSelectInternal = {
  ...listSelectCore,
  _count: {
    select: {
      ctAlerts: {
        where: { status: { in: ["OPEN", "ACKNOWLEDGED"] as const } },
      },
      ctExceptions: {
        where: { status: { in: ["OPEN", "IN_PROGRESS"] as const } },
      },
    },
  },
  ctAlerts: {
    where: { status: { in: ["OPEN", "ACKNOWLEDGED"] as const } },
    orderBy: { createdAt: "asc" as const },
    take: 25,
    select: {
      owner: { select: { id: true, name: true } },
    },
  },
  ctExceptions: {
    where: { status: { in: ["OPEN", "IN_PROGRESS"] as const } },
    orderBy: { createdAt: "asc" as const },
    take: 25,
    select: {
      owner: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ShipmentSelect;

type ShipmentListCore = Prisma.ShipmentGetPayload<{ select: typeof listSelectCore }>;
type ShipmentListInternal = Prisma.ShipmentGetPayload<{ select: typeof listSelectInternal }>;

function mapShipmentListRow(s: ShipmentListCore | ShipmentListInternal) {
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

  const internal = "_count" in s ? s : null;
  const dispatchOwner = internal
    ? (internal.ctAlerts.find((a) => a.owner)?.owner ??
        internal.ctExceptions.find((e) => e.owner)?.owner ??
        null)
    : null;
  const openQueueCounts = internal
    ? {
        openAlerts: internal._count.ctAlerts,
        openExceptions: internal._count.ctExceptions,
      }
    : { openAlerts: 0, openExceptions: 0 };

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
    dispatchOwner,
    openQueueCounts,
    shipperName:
      s.ctReferences.find((r) => r.refType === "SHIPPER")?.refValue ?? null,
    consigneeName:
      s.ctReferences.find((r) => r.refType === "CONSIGNEE")?.refValue ?? null,
    quantityRef:
      s.ctReferences.find((r) => r.refType === "QTY")?.refValue ?? null,
    weightKgRef:
      s.ctReferences.find((r) => r.refType === "WEIGHT_KG")?.refValue ?? null,
    cbmRef:
      s.ctReferences.find((r) => r.refType === "CBM")?.refValue ?? null,
    receivedAt: s.receivedAt?.toISOString() ?? null,
  };
}

export async function listControlTowerShipments(params: {
  tenantId: string;
  ctx: ControlTowerPortalContext;
  query: ListShipmentsQuery;
}) {
  const { tenantId, ctx, query } = params;
  const requestedTake = Math.min(Math.max(query.take ?? 80, 1), 200);
  const routePrefix =
    query.routeActionPrefix &&
    ROUTE_ACTION_PREFIXES.includes(query.routeActionPrefix as (typeof ROUTE_ACTION_PREFIXES)[number])
      ? query.routeActionPrefix
      : "";
  const dbTake = routePrefix ? Math.min(600, Math.max(requestedTake * 5, 120)) : requestedTake;
  const scope = controlTowerShipmentScopeWhere(tenantId, ctx);
  const now = new Date();

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
        { order: { supplier: { is: { name: contains } } } },
        { customerCrmAccount: { is: { name: contains } } },
        { ctReferences: { some: { refValue: contains } } },
        { ctReferences: { some: { refType: contains } } },
        { ctContainers: { some: { containerNumber: contains } } },
      ],
    });
  }
  if (query.onlyOverdueEta) {
    ands.push({
      status: { notIn: [...TERMINAL_SHIPMENT] },
      OR: [
        { booking: { is: { eta: { lt: now } } } },
        { booking: { is: { latestEta: { lt: now } } } },
      ],
    });
  }

  const ownerId = query.dispatchOwnerUserId?.trim();
  if (ownerId && !ctx.isRestrictedView) {
    ands.push({
      OR: [
        {
          ctAlerts: {
            some: {
              status: { in: ["OPEN", "ACKNOWLEDGED"] },
              ownerUserId: ownerId,
            },
          },
        },
        {
          ctExceptions: {
            some: {
              status: { in: ["OPEN", "IN_PROGRESS"] },
              ownerUserId: ownerId,
            },
          },
        },
      ],
    });
  }

  if (ands.length) {
    where.AND = ands;
  }

  const orderBy = { updatedAt: "desc" as const };

  const postFilter = (
    rows: Array<ReturnType<typeof mapShipmentListRow>>,
  ): Array<ReturnType<typeof mapShipmentListRow>> => {
    let out = rows;
    if (routePrefix) {
      out = out.filter((r) => (r.nextAction ?? "").startsWith(routePrefix));
    }
    return out.slice(0, requestedTake);
  };

  if (ctx.isRestrictedView) {
    const rows = await prisma.shipment.findMany({
      where,
      take: dbTake,
      orderBy,
      select: listSelectCore,
    });
    return postFilter(rows.map(mapShipmentListRow));
  }

  const rows = await prisma.shipment.findMany({
    where,
    take: dbTake,
    orderBy,
    select: listSelectInternal,
  });

  return postFilter(rows.map(mapShipmentListRow));
}
