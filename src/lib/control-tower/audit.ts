import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function writeCtAudit(params: {
  tenantId: string;
  shipmentId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  actorUserId: string;
  payload?: Prisma.InputJsonValue;
}) {
  await prisma.ctAuditLog.create({
    data: {
      tenantId: params.tenantId,
      shipmentId: params.shipmentId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      actorUserId: params.actorUserId,
      payload: params.payload ?? undefined,
    },
  });
}
