import { buildApiHubConnectorReadinessSummary } from "@/lib/apihub/connector-readiness";
import type { ApiHubConnectorReadinessReason, ApiHubConnectorReadinessSummaryDto } from "@/lib/apihub/connector-readiness";

/** Lightweight probe severity for dashboards (no secret material). */
export type ApiHubConnectorHealthState = "up" | "degraded" | "down";

export type ApiHubConnectorHealthPayload = {
  state: ApiHubConnectorHealthState;
  /** Operator-safe canned line; never echoes secrets or raw vault refs. */
  summary: string;
  readinessOverall: ApiHubConnectorReadinessSummaryDto["overall"];
  readinessReasons: ApiHubConnectorReadinessReason[];
  lifecycleStatus: string;
  lastSyncAt: string | null;
  sourceKind: string;
  checkedAt: string;
};

export type ApiHubConnectorHealthRowInput = {
  sourceKind: string;
  status: string;
  authMode: string;
  authState: string;
  authConfigRef: string | null;
  lastSyncAt: Date | null;
};

function healthStateFromReadiness(overall: ApiHubConnectorReadinessSummaryDto["overall"]): ApiHubConnectorHealthState {
  if (overall === "blocked") {
    return "down";
  }
  if (overall === "ready") {
    return "up";
  }
  return "degraded";
}

function pickHealthSummary(readiness: ApiHubConnectorReadinessSummaryDto): string {
  if (readiness.overall === "ready") {
    return "Registry row looks ready for ingestion triggers.";
  }
  if (readiness.overall === "blocked") {
    if (readiness.reasons.includes("STATUS_ERROR")) {
      return "Connector lifecycle is in error; operator action required.";
    }
    if (readiness.reasons.includes("AUTH_ERROR")) {
      return "Authentication is in error; update configuration before use.";
    }
    return "Connector is blocked; review lifecycle and authentication.";
  }
  if (readiness.reasons.includes("AUTH_INCOMPLETE")) {
    return "Authentication is incomplete for the selected auth mode.";
  }
  if (readiness.reasons.includes("STATUS_DRAFT")) {
    return "Connector is still in draft; activate when configuration is complete.";
  }
  if (readiness.reasons.includes("STATUS_PAUSED")) {
    return "Connector is paused; resume when ready to accept traffic.";
  }
  if (readiness.reasons.includes("LIFECYCLE_INACTIVE")) {
    return "Connector is not active; lifecycle changes may be required.";
  }
  return "Connector needs attention before production use.";
}

export function buildApiHubConnectorHealthPayload(
  row: ApiHubConnectorHealthRowInput,
  checkedAt: Date = new Date(),
): ApiHubConnectorHealthPayload {
  const readiness = buildApiHubConnectorReadinessSummary({
    status: row.status,
    authMode: row.authMode,
    authState: row.authState,
    authConfigRef: row.authConfigRef,
    lastSyncAt: row.lastSyncAt,
  });
  const sourceKind = row.sourceKind.trim() || "unspecified";
  return {
    state: healthStateFromReadiness(readiness.overall),
    summary: pickHealthSummary(readiness),
    readinessOverall: readiness.overall,
    readinessReasons: [...readiness.reasons],
    lifecycleStatus: row.status.trim().toLowerCase(),
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    sourceKind,
    checkedAt: checkedAt.toISOString(),
  };
}
