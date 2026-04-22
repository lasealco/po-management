import { Prisma } from "@prisma/client";

import { APIHUB_AUDIT_ACTION_INGESTION_RUN_APPLY } from "@/lib/apihub/audit-contract";
import { encodeApplyConflictListCursor } from "@/lib/apihub/apply-conflict-list-cursor";
import type { ApiHubApplyConflictListItemDto } from "@/lib/apihub/ingestion-apply-conflict-dto";
import { prisma } from "@/lib/prisma";

export type { ApiHubApplyConflictListItemDto } from "@/lib/apihub/ingestion-apply-conflict-dto";

type RawApplyConflictRow = {
  id: string;
  ingestionRunId: string;
  actorUserId: string;
  metadata: unknown;
  createdAt: Date;
};

function toDto(row: RawApplyConflictRow): ApiHubApplyConflictListItemDto {
  const meta =
    row.metadata != null && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const resultCode = typeof meta.resultCode === "string" ? meta.resultCode : "UNKNOWN";
  const httpStatus = typeof meta.httpStatus === "number" && Number.isFinite(meta.httpStatus) ? meta.httpStatus : 0;
  const requestId = typeof meta.requestId === "string" ? meta.requestId : null;
  const runStatusAtDecision = typeof meta.runStatusAtDecision === "string" ? meta.runStatusAtDecision : null;
  const connectorId =
    typeof meta.connectorId === "string" || meta.connectorId === null ? (meta.connectorId as string | null) : null;
  return {
    id: row.id,
    ingestionRunId: row.ingestionRunId,
    actorUserId: row.actorUserId,
    createdAt: row.createdAt.toISOString(),
    resultCode,
    httpStatus,
    dryRun: Boolean(meta.dryRun),
    idempotencyKeyPresent: Boolean(meta.idempotencyKeyPresent),
    idempotentReplay: Boolean(meta.idempotentReplay),
    runStatusAtDecision,
    connectorId,
    requestId,
  };
}

/**
 * Lists apply attempts that ended in a client-visible error (HTTP 4xx from apply route),
 * sourced from {@link ApiHubIngestionRunAuditLog} (Slice 46).
 */
export async function listApiHubApplyConflicts(opts: {
  tenantId: string;
  limit: number;
  cursor?: { createdAt: Date; id: string } | null;
}): Promise<{ items: ApiHubApplyConflictListItemDto[]; nextCursor: string | null }> {
  const take = opts.limit + 1;
  const rows = opts.cursor
    ? await prisma.$queryRaw<RawApplyConflictRow[]>(Prisma.sql`
        SELECT id, "ingestionRunId", "actorUserId", metadata, "createdAt"
        FROM "ApiHubIngestionRunAuditLog"
        WHERE "tenantId" = ${opts.tenantId}
          AND action = ${APIHUB_AUDIT_ACTION_INGESTION_RUN_APPLY}
          AND metadata->>'outcome' = 'client_error'
          AND (
            "createdAt" < ${opts.cursor.createdAt}
            OR ("createdAt" = ${opts.cursor.createdAt} AND id < ${opts.cursor.id})
          )
        ORDER BY "createdAt" DESC, id DESC
        LIMIT ${take}
      `)
    : await prisma.$queryRaw<RawApplyConflictRow[]>(Prisma.sql`
        SELECT id, "ingestionRunId", "actorUserId", metadata, "createdAt"
        FROM "ApiHubIngestionRunAuditLog"
        WHERE "tenantId" = ${opts.tenantId}
          AND action = ${APIHUB_AUDIT_ACTION_INGESTION_RUN_APPLY}
          AND metadata->>'outcome' = 'client_error'
        ORDER BY "createdAt" DESC, id DESC
        LIMIT ${take}
      `);

  const hasMore = rows.length > opts.limit;
  const slice = hasMore ? rows.slice(0, opts.limit) : rows;
  let nextCursor: string | null = null;
  if (hasMore && slice.length > 0) {
    const tail = slice[slice.length - 1]!;
    nextCursor = encodeApplyConflictListCursor(tail.createdAt, tail.id);
  }
  return { items: slice.map(toDto), nextCursor };
}
