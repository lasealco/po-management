export type ApiHubConnectorDto = {
  id: string;
  name: string;
  sourceKind: string;
  authMode: string;
  authConfigRef: string | null;
  authState: string;
  status: string;
  lastSyncAt: string | null;
  healthSummary: string | null;
  createdAt: string;
  updatedAt: string;
  auditTrail: ApiHubConnectorAuditTrailDto[];
};

export type ApiHubConnectorAuditTrailDto = {
  id: string;
  actorUserId: string;
  action: string;
  note: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  name: string;
  sourceKind: string;
  authMode: string;
  authConfigRef: string | null;
  authState: string;
  status: string;
  lastSyncAt: Date | null;
  healthSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
  auditLogs?: {
    id: string;
    actorUserId: string;
    action: string;
    note: string | null;
    createdAt: Date;
  }[];
};

export function toApiHubConnectorDto(row: Row): ApiHubConnectorDto {
  return {
    id: row.id,
    name: row.name,
    sourceKind: row.sourceKind,
    authMode: row.authMode,
    authConfigRef: row.authConfigRef,
    authState: row.authState,
    status: row.status,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    healthSummary: row.healthSummary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    auditTrail: (row.auditLogs ?? []).map((audit) => ({
      id: audit.id,
      actorUserId: audit.actorUserId,
      action: audit.action,
      note: audit.note,
      createdAt: audit.createdAt.toISOString(),
    })),
  };
}
