export type ApiHubIngestionRunDto = {
  id: string;
  connectorId: string | null;
  requestedByUserId: string;
  idempotencyKey: string | null;
  status: string;
  triggerKind: string;
  attempt: number;
  maxAttempts: number;
  resultSummary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  enqueuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  retryOfRunId: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  connectorId: string | null;
  requestedByUserId: string;
  idempotencyKey: string | null;
  status: string;
  triggerKind?: string;
  attempt: number;
  maxAttempts: number;
  resultSummary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  enqueuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  retryOfRunId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toApiHubIngestionRunDto(row: Row): ApiHubIngestionRunDto {
  return {
    id: row.id,
    connectorId: row.connectorId,
    requestedByUserId: row.requestedByUserId,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    triggerKind: row.triggerKind ?? "api",
    attempt: row.attempt,
    maxAttempts: row.maxAttempts,
    resultSummary: row.resultSummary,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    enqueuedAt: row.enqueuedAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    retryOfRunId: row.retryOfRunId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
