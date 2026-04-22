import { NextResponse } from "next/server";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

export type ApiHubValidationIssue = {
  field: string;
  code: string;
  message: string;
  recordIndex?: number;
  /** When omitted, treat as blocking (`error`). */
  severity?: "error" | "warn" | "info";
};

type ApiHubErrorPayload = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: {
      issues: ApiHubValidationIssue[];
      summary: {
        totalErrors: number;
        byCode: Record<string, number>;
        bySeverity: Record<"error" | "warn" | "info", number>;
      };
    };
  };
};

function summarizeIssues(issues: ApiHubValidationIssue[]) {
  const byCode: Record<string, number> = {};
  const bySeverity: Record<"error" | "warn" | "info", number> = { error: 0, warn: 0, info: 0 };
  for (const issue of issues) {
    byCode[issue.code] = (byCode[issue.code] ?? 0) + 1;
    const s = issue.severity === "warn" || issue.severity === "info" ? issue.severity : "error";
    bySeverity[s] += 1;
  }
  return { totalErrors: issues.length, byCode, bySeverity };
}

function withRequestIdHeaders(requestId: string): HeadersInit {
  return { [APIHUB_REQUEST_ID_HEADER]: requestId };
}

export function apiHubJson<T>(body: T, requestId: string, status = 200) {
  return NextResponse.json(body, { status, headers: withRequestIdHeaders(requestId) });
}

export function apiHubError(status: number, code: string, message: string, requestId: string) {
  const body: ApiHubErrorPayload = { ok: false, error: { code, message } };
  return NextResponse.json(body, { status, headers: withRequestIdHeaders(requestId) });
}

export function apiHubValidationError(
  status: number,
  code: string,
  message: string,
  issues: ApiHubValidationIssue[],
  requestId: string,
) {
  const body: ApiHubErrorPayload = {
    ok: false,
    error: {
      code,
      message,
      details: {
        issues,
        summary: summarizeIssues(issues),
      },
    },
  };
  return NextResponse.json(body, { status, headers: withRequestIdHeaders(requestId) });
}

/** Standard demo-session / seed gate for API Hub routes (structured error). */
export function apiHubDemoTenantMissing(requestId: string) {
  return apiHubError(
    404,
    "TENANT_NOT_FOUND",
    "Demo tenant not found. Run `npm run db:seed` to create starter data.",
    requestId,
  );
}

/** Standard demo actor gate for API Hub routes (structured error). */
export function apiHubDemoActorMissing(requestId: string) {
  return apiHubError(
    403,
    "ACTOR_NOT_FOUND",
    "No active demo user for this session. Open Settings → Demo session (/settings/demo) to choose who you are acting as.",
    requestId,
  );
}

/**
 * Maps **`createApiHubStagingBatchFromAnalysisJob`** failures to an operator-safe message.
 * Unknown errors (e.g. Prisma engine) return **`fallback`** so internal details are not echoed (R7).
 */
export function apiHubStagingBatchCreateFailedMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || typeof error.message !== "string") {
    return fallback;
  }
  const m = error.message.trim();
  if (
    m === "Analysis job not found, wrong tenant, or not succeeded." ||
    m === "Job input has no records array." ||
    m === "Job output has no rules array."
  ) {
    return m;
  }
  if (/^At most \d+ rows per staging batch\.$/.test(m)) {
    return m;
  }
  return fallback;
}

/** Parse API Hub JSON error bodies from fetch (legacy `{ error }` or structured `{ ok:false, error:{ message } }`). */
export function readApiHubErrorMessageFromJsonBody(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") {
    return fallback;
  }
  const o = data as Record<string, unknown>;
  if (typeof o.error === "string") {
    return o.error;
  }
  if (o.ok === false && o.error && typeof o.error === "object") {
    const inner = o.error as Record<string, unknown>;
    if (typeof inner.message === "string") {
      return inner.message;
    }
  }
  return fallback;
}
