/** One row from `GET /api/apihub/ingestion-apply-conflicts` (Slice 46/47). */
export type ApiHubApplyConflictListItemDto = {
  id: string;
  ingestionRunId: string;
  actorUserId: string;
  createdAt: string;
  resultCode: string;
  httpStatus: number;
  dryRun: boolean;
  idempotencyKeyPresent: boolean;
  idempotentReplay: boolean;
  runStatusAtDecision: string | null;
  connectorId: string | null;
  requestId: string | null;
};
