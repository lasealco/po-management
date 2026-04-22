import type { Prisma } from "@prisma/client";

import type { ApiHubIngestionRunAuditAction } from "@/lib/apihub/audit-contract";
import { prisma } from "@/lib/prisma";

export type { ApiHubIngestionRunAuditAction } from "@/lib/apihub/audit-contract";

/**
 * Append-only audit row for ingestion apply/retry (Slice 45).
 * `metadata` should include `schemaVersion` + `resourceType` (`ingestion_run`, Slice 63), plus stable
 * `resultCode`, `httpStatus`, `requestId`, `verb`, and `actorUserId` (duplicate of the column) so consumers
 * that export or query JSON-only payloads retain actor traceability.
 */
export async function appendApiHubIngestionRunAuditLog(opts: {
  tenantId: string;
  actorUserId: string;
  ingestionRunId: string;
  action: ApiHubIngestionRunAuditAction;
  note?: string | null;
  metadata: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.apiHubIngestionRunAuditLog.create({
    data: {
      tenantId: opts.tenantId,
      actorUserId: opts.actorUserId,
      ingestionRunId: opts.ingestionRunId,
      action: opts.action,
      note: opts.note ?? null,
      metadata: opts.metadata,
    },
  });
}
