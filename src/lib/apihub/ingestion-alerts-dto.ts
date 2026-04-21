/** Severity for operator triage (Slice 48). */
export type ApiHubIngestionAlertSeverity = "error" | "warn" | "info";

/** Single alert derived from ingestion lifecycle audit rows. */
export type ApiHubIngestionAlertItemDto = {
  /** Audit log row id (stable reference for integrations). */
  id: string;
  severity: ApiHubIngestionAlertSeverity;
  source: "apply" | "retry";
  resultCode: string;
  title: string;
  detail: string;
  createdAt: string;
  ingestionRunId: string;
  httpStatus: number;
  requestId: string | null;
};

/** Aggregated post-apply / retry failure signals for UI and integrations. */
export type ApiHubIngestionAlertsSummaryDto = {
  generatedAt: string;
  /** Max rows scanned (requested limit, capped server-side). */
  limit: number;
  counts: {
    error: number;
    warn: number;
    info: number;
  };
  alerts: ApiHubIngestionAlertItemDto[];
};
