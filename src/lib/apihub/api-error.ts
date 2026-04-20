import { NextResponse } from "next/server";

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

export function apiHubError(status: number, code: string, message: string) {
  const body: ApiHubErrorPayload = { ok: false, error: { code, message } };
  return NextResponse.json(body, { status });
}

export function apiHubValidationError(
  status: number,
  code: string,
  message: string,
  issues: ApiHubValidationIssue[],
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
  return NextResponse.json(body, { status });
}
