import { NextResponse } from "next/server";

export type ApiErrorBody<
  TCode extends string = string,
  TExtra extends Record<string, unknown> = Record<never, never>,
> = { error: string; code: TCode } & TExtra;

type ApiErrorResponseParams<TCode extends string, TExtra extends Record<string, unknown>> = {
  error: string;
  code: TCode;
  status: number;
  extra?: TExtra;
};

export function toApiErrorBody<
  TCode extends string,
  TExtra extends Record<string, unknown> = Record<never, never>,
>(error: string, code: TCode, extra?: TExtra): ApiErrorBody<TCode, TExtra> {
  return {
    error,
    code,
    ...(extra ?? ({} as TExtra)),
  };
}

export function toApiErrorResponse<
  TCode extends string,
  TExtra extends Record<string, unknown> = Record<never, never>,
>(params: ApiErrorResponseParams<TCode, TExtra>): NextResponse {
  return NextResponse.json(toApiErrorBody(params.error, params.code, params.extra), {
    status: params.status,
  });
}

/** Maps HTTP status to a stable machine code for `toApiErrorResponse` (lib + route helpers). */
export function errorCodeForHttpStatus(status: number): string {
  switch (status) {
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 503:
      return "UNAVAILABLE";
    default:
      if (status >= 500) return "UNHANDLED";
      return "BAD_INPUT";
  }
}

/** Error JSON from a message + HTTP status (dynamic status from validators, gates, etc.). */
export function toApiErrorResponseFromStatus(
  error: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return toApiErrorResponse({
    error,
    code: errorCodeForHttpStatus(status),
    status,
    extra,
  });
}

export function statusFromErrorCode<TCode extends string>(
  code: TCode,
  statusByCode: Partial<Record<TCode, number>>,
  fallbackStatus = 400,
): number {
  return statusByCode[code] ?? fallbackStatus;
}
