export type ApiHubConnectorDto = {
  id: string;
  name: string;
  sourceKind: string;
  status: string;
  lastSyncAt: string | null;
  healthSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  name: string;
  sourceKind: string;
  status: string;
  lastSyncAt: Date | null;
  healthSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toApiHubConnectorDto(row: Row): ApiHubConnectorDto {
  return {
    id: row.id,
    name: row.name,
    sourceKind: row.sourceKind,
    status: row.status,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    healthSummary: row.healthSummary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
