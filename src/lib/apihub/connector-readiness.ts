import type { ApiHubConnectorAuthState } from "@/lib/apihub/constants";
import { APIHUB_CONNECTOR_AUTH_STATES } from "@/lib/apihub/constants";

/** Stable machine-readable codes for operator dashboards (subset may be present). */
export type ApiHubConnectorReadinessReason =
  | "STATUS_ERROR"
  | "STATUS_DRAFT"
  | "STATUS_PAUSED"
  | "AUTH_ERROR"
  | "AUTH_INCOMPLETE"
  | "LIFECYCLE_INACTIVE";

export type ApiHubConnectorReadinessSummaryDto = {
  /** Rollup: `blocked` on lifecycle/auth error; `ready` when live + auth gate passes; else `attention`. */
  overall: "ready" | "attention" | "blocked";
  /** Non-empty when there are operator-visible gaps (ordered, deduped). */
  reasons: ApiHubConnectorReadinessReason[];
  /** Auth wiring appears sufficient for the declared `authMode` (no secret values evaluated). */
  authReady: boolean;
  /** Normalized auth state from storage; `unknown` when the stored value is not in the allowlist. */
  authState: ApiHubConnectorAuthState | "unknown";
  /** Whether a non-empty `authConfigRef` exists (boolean only; ref is never exposed on the DTO). */
  hasAuthConfigRef: boolean;
  /** `status` is active (case-insensitive). */
  lifecycleActive: boolean;
  /** `lastSyncAt` is set. */
  syncObserved: boolean;
};

export type ApiHubConnectorReadinessInput = {
  status: string;
  authMode: string;
  authState: string | null | undefined;
  authConfigRef: string | null | undefined;
  lastSyncAt: Date | null | undefined;
};

export function normalizeConnectorAuthState(raw: string | null | undefined): ApiHubConnectorAuthState | "unknown" {
  const s = (raw ?? "").trim().toLowerCase();
  if (APIHUB_CONNECTOR_AUTH_STATES.includes(s as ApiHubConnectorAuthState)) {
    return s as ApiHubConnectorAuthState;
  }
  return "unknown";
}

export function isConnectorAuthReady(input: {
  authMode: string;
  authState: ApiHubConnectorAuthState | "unknown";
  authConfigRef: string | null | undefined;
}): boolean {
  const mode = input.authMode.trim().toLowerCase();
  if (mode === "none") {
    return input.authState !== "error";
  }
  const refOk = (input.authConfigRef ?? "").trim().length > 0;
  return input.authState === "configured" && refOk;
}

const REASON_ORDER: ApiHubConnectorReadinessReason[] = [
  "STATUS_ERROR",
  "STATUS_DRAFT",
  "STATUS_PAUSED",
  "AUTH_ERROR",
  "AUTH_INCOMPLETE",
  "LIFECYCLE_INACTIVE",
];

function sortReasons(reasons: Set<ApiHubConnectorReadinessReason>): ApiHubConnectorReadinessReason[] {
  return REASON_ORDER.filter((r) => reasons.has(r));
}

export function buildApiHubConnectorReadinessSummary(row: ApiHubConnectorReadinessInput): ApiHubConnectorReadinessSummaryDto {
  const status = row.status.trim().toLowerCase();
  const authState = normalizeConnectorAuthState(row.authState);
  const hasAuthConfigRef = (row.authConfigRef ?? "").trim().length > 0;
  const lifecycleActive = status === "active";
  const syncObserved = row.lastSyncAt != null;
  const authReady = isConnectorAuthReady({
    authMode: row.authMode,
    authState,
    authConfigRef: row.authConfigRef,
  });

  const blocked = status === "error" || authState === "error";
  const ready = !blocked && lifecycleActive && authReady;

  const reasons = new Set<ApiHubConnectorReadinessReason>();
  if (blocked) {
    if (status === "error") {
      reasons.add("STATUS_ERROR");
    }
    if (authState === "error") {
      reasons.add("AUTH_ERROR");
    }
  } else if (!ready) {
    if (status === "draft") {
      reasons.add("STATUS_DRAFT");
    }
    if (status === "paused") {
      reasons.add("STATUS_PAUSED");
    }
    if (!authReady) {
      reasons.add("AUTH_INCOMPLETE");
    }
    if (!lifecycleActive && status !== "draft" && status !== "paused") {
      reasons.add("LIFECYCLE_INACTIVE");
    }
  }

  const overall: ApiHubConnectorReadinessSummaryDto["overall"] = blocked ? "blocked" : ready ? "ready" : "attention";

  return {
    overall,
    reasons: sortReasons(reasons),
    authReady,
    authState,
    hasAuthConfigRef,
    lifecycleActive,
    syncObserved,
  };
}
