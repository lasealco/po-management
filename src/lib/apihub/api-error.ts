import { NextResponse } from "next/server";

import { APIHUB_REQUEST_ID_HEADER } from "@/lib/apihub/request-id";

export type ApiHubValidationIssue = {
  field: string;
  code: string;
  message: string;
  recordIndex?: number;
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
      };
    };
  };
};

function summarizeIssues(issues: ApiHubValidationIssue[]) {
  const byCode: Record<string, number> = {};
  for (const issue of issues) {
    byCode[issue.code] = (byCode[issue.code] ?? 0) + 1;
  }
  return { totalErrors: issues.length, byCode };
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
