import type { Prisma, TwinRiskSeverity } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { encodeTwinRiskSignalsListCursor } from "@/lib/supply-chain-twin/schemas/twin-risk-signals-list-query";

export type RiskSignalListItem = {
  id: string;
  code: string;
  severity: TwinRiskSeverity;
  title: string;
  detail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PatchRiskSignalAckResult =
  | {
      ok: true;
      row: {
        id: string;
        acknowledged: boolean;
        acknowledgedAt: Date | null;
        acknowledgedByActorId: string | null;
      };
    }
  | { ok: false; reason: "not_found" };

/**
 * Keyset-paged risk signals for a tenant (`createdAt` desc, `id` desc). `limit` is clamped to 1..100.
 */
export async function listRiskSignalsForTenantPage(
  tenantId: string,
  options: {
    limit: number;
    cursorPosition?: { createdAt: Date; id: string } | null;
    severity?: TwinRiskSeverity;
  },
): Promise<{ items: RiskSignalListItem[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit, 1), 100);
  const cursorPos = options.cursorPosition ?? null;

  const where: Prisma.SupplyChainTwinRiskSignalWhereInput = {
    tenantId,
    ...(options.severity ? { severity: options.severity } : {}),
    ...(cursorPos
      ? {
          OR: [
            { createdAt: { lt: cursorPos.createdAt } },
            {
              AND: [{ createdAt: cursorPos.createdAt }, { id: { lt: cursorPos.id } }],
            },
          ],
        }
      : {}),
  };

  const rows = await prisma.supplyChainTwinRiskSignal.findMany({
    where,
    select: {
      id: true,
      code: true,
      severity: true,
      title: true,
      detail: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last != null
      ? encodeTwinRiskSignalsListCursor({
          createdAt: last.createdAt,
          id: last.id,
        })
      : null;

  return { items: pageRows, nextCursor };
}

/**
 * Tenant-scoped ack/unack patch for one risk signal id. Repeated requests with the same value are idempotent.
 */
export async function patchRiskSignalAckForTenant(
  tenantId: string,
  riskSignalId: string,
  input: { acknowledged: boolean; actorId: string | null; now?: Date },
): Promise<PatchRiskSignalAckResult> {
  const row = await prisma.supplyChainTwinRiskSignal.findFirst({
    where: { tenantId, id: riskSignalId },
    select: { id: true },
  });
  if (!row) {
    return { ok: false, reason: "not_found" };
  }

  const now = input.now ?? new Date();
  const updated = await prisma.supplyChainTwinRiskSignal.update({
    where: { id: riskSignalId },
    data: input.acknowledged
      ? {
          acknowledged: true,
          acknowledgedAt: now,
          acknowledgedByActorId: input.actorId,
        }
      : {
          acknowledged: false,
          acknowledgedAt: null,
          acknowledgedByActorId: null,
        },
    select: {
      id: true,
      acknowledged: true,
      acknowledgedAt: true,
      acknowledgedByActorId: true,
    },
  });

  return { ok: true, row: updated };
}
