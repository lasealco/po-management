import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type TwinMutationAuditAction =
  | "scenario_deleted"
  | "risk_signal_ack_patched"
  | "integrity_repair_apply_executed";

/**
 * Appends a tenant-scoped mutation audit marker to the Twin ingest spine.
 * Payload must stay metadata-only (no raw business payloads).
 */
export async function appendTwinMutationAuditEvent(input: {
  tenantId: string;
  actorId: string | null;
  action: TwinMutationAuditAction;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  const payload: Prisma.InputJsonValue = {
    action: input.action,
    actorId: input.actorId,
    targetId: input.targetId ?? null,
    ...(input.metadata ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
  };

  await prisma.supplyChainTwinIngestEvent.create({
    data: {
      tenantId: input.tenantId,
      type: "mutation_audit",
      payloadJson: payload,
    },
    select: { id: true },
  });
}
