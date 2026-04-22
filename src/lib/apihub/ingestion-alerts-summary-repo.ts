import { Prisma } from "@prisma/client";

import {
  APIHUB_AUDIT_ACTION_INGESTION_RUN_APPLY,
  APIHUB_AUDIT_ACTION_INGESTION_RUN_RETRY,
} from "@/lib/apihub/audit-contract";
import type {
  ApiHubIngestionAlertItemDto,
  ApiHubIngestionAlertSeverity,
  ApiHubIngestionAlertsSummaryDto,
} from "@/lib/apihub/ingestion-alerts-dto";
import { prisma } from "@/lib/prisma";

type RawAuditRow = {
  id: string;
  ingestionRunId: string;
  action: string;
  metadata: unknown;
  createdAt: Date;
};

function asMetaRecord(metadata: unknown): Record<string, unknown> {
  if (metadata != null && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function severityFor(resultCode: string): ApiHubIngestionAlertSeverity {
  if (
    resultCode === "APPLY_IDEMPOTENCY_KEY_CONFLICT" ||
    resultCode === "RETRY_IDEMPOTENCY_KEY_CONFLICT"
  ) {
    return "warn";
  }
  return "error";
}

function titleFor(action: "apply" | "retry", resultCode: string): string {
  if (action === "retry") {
    switch (resultCode) {
      case "RETRY_REQUIRES_FAILED":
        return "Retry blocked — run is not in failed status";
      case "RETRY_LIMIT_REACHED":
        return "Retry blocked — attempt budget exhausted";
      case "RETRY_IDEMPOTENCY_KEY_CONFLICT":
        return "Retry idempotency key conflict";
      case "RUN_NOT_FOUND":
        return "Retry target run not found";
      default:
        return `Retry issue (${resultCode})`;
    }
  }
  switch (resultCode) {
    case "APPLY_RUN_NOT_SUCCEEDED":
      return "Apply blocked — ingestion run not succeeded";
    case "APPLY_ALREADY_APPLIED":
      return "Apply blocked — run already marked applied";
    case "APPLY_BLOCKED_CONNECTOR_NOT_FOUND":
      return "Apply blocked — connector missing";
    case "APPLY_BLOCKED_CONNECTOR_NOT_ACTIVE":
      return "Apply blocked — connector not active";
    case "APPLY_IDEMPOTENCY_KEY_CONFLICT":
      return "Apply idempotency key reused for a different run";
    case "RUN_NOT_FOUND":
      return "Apply target run not found";
    default:
      return `Apply issue (${resultCode})`;
  }
}

function detailFor(meta: Record<string, unknown>, resultCode: string): string {
  const parts: string[] = [];
  const http = meta.httpStatus;
  if (typeof http === "number" && Number.isFinite(http)) {
    parts.push(`HTTP ${http}`);
  }
  if (typeof meta.runStatusAtDecision === "string" && meta.runStatusAtDecision.length > 0) {
    parts.push(`run status ${meta.runStatusAtDecision}`);
  }
  if (typeof meta.connectorId === "string" && meta.connectorId.length > 0) {
    parts.push(`connector ${meta.connectorId}`);
  }
  if (parts.length === 0) {
    return `Code ${resultCode}`;
  }
  return parts.join(" · ");
}

function normalizeLifecycleAction(raw: string): "apply" | "retry" | null {
  if (raw === "apply" || raw === APIHUB_AUDIT_ACTION_INGESTION_RUN_APPLY) {
    return "apply";
  }
  if (raw === "retry" || raw === APIHUB_AUDIT_ACTION_INGESTION_RUN_RETRY) {
    return "retry";
  }
  return null;
}

function rowToAlert(row: RawAuditRow): ApiHubIngestionAlertItemDto | null {
  const source = normalizeLifecycleAction(row.action);
  if (!source) {
    return null;
  }
  const meta = asMetaRecord(row.metadata);
  const resultCode = typeof meta.resultCode === "string" ? meta.resultCode : "UNKNOWN";
  const httpStatus = typeof meta.httpStatus === "number" && Number.isFinite(meta.httpStatus) ? meta.httpStatus : 0;
  const requestId = typeof meta.requestId === "string" ? meta.requestId : null;
  const sev = severityFor(resultCode);
  return {
    id: row.id,
    severity: sev,
    source,
    resultCode,
    title: titleFor(source, resultCode),
    detail: detailFor(meta, resultCode),
    createdAt: row.createdAt.toISOString(),
    ingestionRunId: row.ingestionRunId,
    httpStatus,
    requestId,
  };
}

/**
 * Builds an alert-style summary from recent apply/retry audit rows with `outcome === client_error` (Slice 48).
 */
export async function getApiHubIngestionAlertsSummary(opts: {
  tenantId: string;
  limit: number;
}): Promise<ApiHubIngestionAlertsSummaryDto> {
  const take = Math.min(Math.max(opts.limit, 1), 50);
  const rows = await prisma.$queryRaw<RawAuditRow[]>(Prisma.sql`
    SELECT id, "ingestionRunId", action, metadata, "createdAt"
    FROM "ApiHubIngestionRunAuditLog"
    WHERE "tenantId" = ${opts.tenantId}
      AND action IN (${APIHUB_AUDIT_ACTION_INGESTION_RUN_APPLY}, ${APIHUB_AUDIT_ACTION_INGESTION_RUN_RETRY}, 'apply', 'retry')
      AND metadata->>'outcome' = 'client_error'
    ORDER BY "createdAt" DESC, id DESC
    LIMIT ${take}
  `);

  const alerts: ApiHubIngestionAlertItemDto[] = [];
  const counts = { error: 0, warn: 0, info: 0 };
  for (const row of rows) {
    const a = rowToAlert(row);
    if (!a) continue;
    alerts.push(a);
    if (a.severity === "error") counts.error += 1;
    else if (a.severity === "warn") counts.warn += 1;
    else counts.info += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    limit: take,
    counts,
    alerts,
  };
}
