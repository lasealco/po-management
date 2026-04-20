import { APIHUB_INGESTION_JOB_STATUSES } from "./constants";

export type ApiHubRunStatus = (typeof APIHUB_INGESTION_JOB_STATUSES)[number];

const ALLOWED_STATUS_TRANSITIONS: Record<ApiHubRunStatus, ApiHubRunStatus[]> = {
  queued: ["running", "failed"],
  running: ["succeeded", "failed"],
  succeeded: [],
  failed: [],
};

export function isValidRunStatus(value: string): value is ApiHubRunStatus {
  return APIHUB_INGESTION_JOB_STATUSES.includes(value as ApiHubRunStatus);
}

export function canTransitionRunStatus(from: ApiHubRunStatus, to: ApiHubRunStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}
