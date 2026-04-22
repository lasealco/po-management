import type { ApiHubConnectorReadinessSummaryDto } from "@/lib/apihub/connector-readiness";
import { buildApiHubConnectorReadinessSummary } from "@/lib/apihub/connector-readiness";

export type ApiHubConnectorDto = {
  id: string;
  name: string;
  sourceKind: string;
  status: string;
  authMode: string;
  lastSyncAt: string | null;
  healthSummary: string | null;
  /** Operator metadata; persisted on the connector row (non-secret). */
  opsNote: string | null;
  /** Derived readiness rollup for list/detail payloads (Slice 18). */
  readinessSummary: ApiHubConnectorReadinessSummaryDto;
  createdAt: string;
  updatedAt: string;
  auditTrail: ApiHubConnectorAuditTrailDto[];
};

export type ApiHubConnectorAuditTrailDto = {
  id: string;
  actorUserId: string;
  /** Demo-tenant user email (no secrets). */
  actorEmail: string;
  /** Demo-tenant display name. */
  actorName: string;
  action: string;
  note: string | null;
  createdAt: string;
};

type AuditLogRowLike = {
  id: string;
  actorUserId: string;
  actorEmail?: string | null;
  actorName?: string | null;
  action: string;
  note: string | null;
  createdAt: Date;
};

export function toApiHubConnectorAuditLogDto(row: AuditLogRowLike): ApiHubConnectorAuditTrailDto {
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    actorEmail: (row.actorEmail ?? "").trim(),
    actorName: (row.actorName ?? "").trim(),
    action: row.action,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

type Row = {
  id: string;
  name: string;
  sourceKind: string;
  status: string;
  authMode: string;
  authState?: string | null;
  /** Used only to compute readiness; never serialized on the DTO. */
  authConfigRef?: string | null;
  lastSyncAt: Date | null;
  healthSummary: string | null;
  opsNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
  auditLogs?: {
    id: string;
    actorUserId: string;
    actorEmail?: string | null;
    actorName?: string | null;
    action: string;
    note: string | null;
    createdAt: Date;
  }[];
};

export function toApiHubConnectorDto(row: Row): ApiHubConnectorDto {
  const readinessSummary = buildApiHubConnectorReadinessSummary({
    status: row.status,
    authMode: row.authMode,
    authState: row.authState,
    authConfigRef: row.authConfigRef,
    lastSyncAt: row.lastSyncAt,
  });
  return {
    id: row.id,
    name: row.name,
    sourceKind: row.sourceKind,
    status: row.status,
    authMode: row.authMode,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    healthSummary: row.healthSummary,
    opsNote: row.opsNote ?? null,
    readinessSummary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    auditTrail: (row.auditLogs ?? []).map((audit) => toApiHubConnectorAuditLogDto(audit)),
  };
}
