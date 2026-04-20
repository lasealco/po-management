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

export function statusFromErrorCode<TCode extends string>(
  code: TCode,
  statusByCode: Partial<Record<TCode, number>>,
  fallbackStatus = 400,
): number {
  return statusByCode[code] ?? fallbackStatus;
}
