import { NextResponse } from "next/server";

import { statusFromErrorCode, toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { RfqRepoError } from "@/lib/rfq/rfq-repo-error";

export function jsonFromRfqError(e: unknown): NextResponse | null {
  if (!(e instanceof RfqRepoError)) return null;
  const status = statusFromErrorCode(
    e.code,
    {
      NOT_FOUND: 404,
      CONFLICT: 409,
      BAD_INPUT: 400,
    },
    400,
  );
  return toApiErrorResponse({ error: e.message, code: e.code, status });
}
