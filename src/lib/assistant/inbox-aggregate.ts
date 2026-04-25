import type { Prisma } from "@prisma/client";
import { CtAlertStatus, CtExceptionStatus } from "@prisma/client";

import { controlTowerShipmentAccessWhere } from "@/lib/control-tower/viewer";
import type { ControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { prisma } from "@/lib/prisma";

export type AssistantInboxItemKind = "ct_alert" | "ct_exception" | "so_draft";

export type AssistantInboxItem = {
  id: string;
  kind: AssistantInboxItemKind;
  title: string;
  subtitle: string | null;
  href: string;
  createdAt: string;
  /** For acknowledge action on alerts */
  alertId?: string;
  /** Shipment context for CT rows */
  shipmentId?: string;
  shipmentNo?: string | null;
};

export type AssistantInboxPayload = {
  items: AssistantInboxItem[];
  /** Count of rows in this response (for badge) */
  total: number;
  producers: { ctAlerts: boolean; ctExceptions: boolean; soDrafts: boolean };
};

/**
 * Aggregates open Control Tower alerts, open/in-progress exceptions, and draft sales orders
 * for the Mega-Phase 2 attention surface. Respects CT shipment access scope.
 */
export async function buildAssistantInbox(params: {
  tenantId: string;
  actorUserId: string;
  ctCtx: ControlTowerPortalContext;
  include: { ctAlerts: boolean; ctExceptions: boolean; soDrafts: boolean };
}): Promise<AssistantInboxPayload> {
  const { tenantId, actorUserId, ctCtx, include } = params;
  const items: AssistantInboxItem[] = [];

  if (include.ctAlerts) {
    const shipWhere = await controlTowerShipmentAccessWhere(tenantId, ctCtx, actorUserId);
    const alerts = await prisma.ctAlert.findMany({
      where: {
        tenantId,
        status: CtAlertStatus.OPEN,
        shipment: { is: shipWhere },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        severity: true,
        createdAt: true,
        shipmentId: true,
        shipment: { select: { shipmentNo: true } },
      },
    });
    for (const a of alerts) {
      items.push({
        id: `alert-${a.id}`,
        kind: "ct_alert",
        title: a.title,
        subtitle: a.shipment?.shipmentNo ? `Shipment ${a.shipment.shipmentNo}` : "Shipment",
        href: `/control-tower/shipments/${a.shipmentId}`,
        createdAt: a.createdAt.toISOString(),
        alertId: a.id,
        shipmentId: a.shipmentId,
        shipmentNo: a.shipment?.shipmentNo ?? null,
      });
    }
  }

  if (include.ctExceptions) {
    const shipWhere = await controlTowerShipmentAccessWhere(tenantId, ctCtx, actorUserId);
    const exWhere: Prisma.CtExceptionWhereInput = {
      tenantId,
      status: { in: [CtExceptionStatus.OPEN, CtExceptionStatus.IN_PROGRESS] },
      shipment: { is: shipWhere },
    };
    const exceptions = await prisma.ctException.findMany({
      where: exWhere,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        shipmentId: true,
        shipment: { select: { shipmentNo: true } },
      },
    });
    for (const e of exceptions) {
      items.push({
        id: `ex-${e.id}`,
        kind: "ct_exception",
        title: e.type || "Exception",
        subtitle: `${e.status} · ${e.shipment?.shipmentNo ? `Shipment ${e.shipment.shipmentNo}` : "Shipment"}`,
        href: `/control-tower/shipments/${e.shipmentId}`,
        createdAt: e.createdAt.toISOString(),
        shipmentId: e.shipmentId,
        shipmentNo: e.shipment?.shipmentNo ?? null,
      });
    }
  }

  if (include.soDrafts) {
    const drafts = await prisma.salesOrder.findMany({
      where: { tenantId, status: "DRAFT" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        soNumber: true,
        customerName: true,
        updatedAt: true,
        externalRef: true,
      },
    });
    for (const s of drafts) {
      items.push({
        id: `so-${s.id}`,
        kind: "so_draft",
        title: `Sales order ${s.soNumber}`,
        subtitle: s.customerName + (s.externalRef ? ` · ${s.externalRef.slice(0, 80)}` : ""),
        href: `/sales-orders/${s.id}`,
        createdAt: s.updatedAt.toISOString(),
      });
    }
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    items,
    total: items.length,
    producers: {
      ctAlerts: include.ctAlerts,
      ctExceptions: include.ctExceptions,
      soDrafts: include.soDrafts,
    },
  };
}
