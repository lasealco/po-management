import { NextResponse } from "next/server";

import { statusFromErrorCode, toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { SnapshotRepoError } from "@/lib/booking-pricing-snapshot/snapshot-repo-error";

export function jsonFromSnapshotError(e: unknown): NextResponse | null {
  if (!(e instanceof SnapshotRepoError)) return null;
  const status = statusFromErrorCode(
    e.code,
    {
      NOT_FOUND: 404,
      FORBIDDEN: 403,
      BAD_INPUT: 400,
    },
    400,
  );
  return toApiErrorResponse({ error: e.message, code: e.code, status });
}
