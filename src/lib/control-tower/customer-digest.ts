import {
  type ControlTowerPortalContext,
  controlTowerShipmentAccessWhere,
} from "@/lib/control-tower/viewer";
import { prisma } from "@/lib/prisma";

/** Max rows returned (most recently updated first). */
export const DIGEST_MAX_ITEMS = 250;

export type ControlTowerDigestItem = {
  id: string;
  shipmentNo: string | null;
  status: string;
  eta: string | null;
  originCode: string | null;
  destinationCode: string | null;
  latestMilestone: { code: string; hasActual: boolean } | null;
};

export type ControlTowerDigestPayload = {
  generatedAt: string;
  digestLimit: number;
  itemCount: number;
  truncated: boolean;
  view: {
    restricted: boolean;
    supplierPortal: boolean;
    customerCrmAccountId: string | null;
  };
  items: ControlTowerDigestItem[];
};

export async function buildControlTowerDigest(params: {
  tenantId: string;
  ctx: ControlTowerPortalContext;
  actorUserId: string;
}): Promise<ControlTowerDigestPayload> {
  const { tenantId, ctx, actorUserId } = params;
  const scope = await controlTowerShipmentAccessWhere(tenantId, ctx, actorUserId);
  const shipments = await prisma.shipment.findMany({
    where: scope,
    select: {
      id: true,
      shipmentNo: true,
      status: true,
      booking: { select: { eta: true, latestEta: true, originCode: true, destinationCode: true } },
      milestones: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { code: true, actualAt: true },
      },
    },
    take: DIGEST_MAX_ITEMS,
    orderBy: { updatedAt: "desc" },
  });

  return {
    generatedAt: new Date().toISOString(),
    digestLimit: DIGEST_MAX_ITEMS,
    itemCount: shipments.length,
    truncated: shipments.length >= DIGEST_MAX_ITEMS,
    view: {
      restricted: ctx.isRestrictedView,
      supplierPortal: ctx.isSupplierPortal,
      customerCrmAccountId: ctx.customerCrmAccountId,
    },
    items: shipments.map((s) => ({
      id: s.id,
      shipmentNo: s.shipmentNo,
      status: s.status,
      eta: s.booking?.latestEta?.toISOString() ?? s.booking?.eta?.toISOString() ?? null,
      originCode: s.booking?.originCode ?? null,
      destinationCode: s.booking?.destinationCode ?? null,
      latestMilestone: s.milestones[0]
        ? { code: s.milestones[0].code, hasActual: Boolean(s.milestones[0].actualAt) }
        : null,
    })),
  };
}
