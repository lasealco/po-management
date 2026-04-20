import { NextResponse } from "next/server";

import { statusFromErrorCode, toApiErrorBody, toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

export type TariffApiErrorBody = { error: string; code: TariffRepoError["code"] | "BAD_INPUT" };

export function toTariffApiErrorBody(
  error: string,
  code: TariffRepoError["code"] | "BAD_INPUT",
): TariffApiErrorBody {
  return toApiErrorBody(error, code);
}

export function jsonFromTariffError(e: unknown): NextResponse | null {
  if (!(e instanceof TariffRepoError)) return null;
  const status = statusFromErrorCode(
    e.code,
    {
      NOT_FOUND: 404,
      TENANT_MISMATCH: 403,
      VERSION_FROZEN: 409,
      CONFLICT: 409,
      BAD_INPUT: 400,
    },
    400,
  );
  return toApiErrorResponse({ error: e.message, code: e.code, status });
}
