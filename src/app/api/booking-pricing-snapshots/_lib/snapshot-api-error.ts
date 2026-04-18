import { NextResponse } from "next/server";

import { SnapshotRepoError } from "@/lib/booking-pricing-snapshot/snapshot-repo-error";

export function jsonFromSnapshotError(e: unknown): NextResponse | null {
  if (!(e instanceof SnapshotRepoError)) return null;
  const status = e.code === "NOT_FOUND" ? 404 : e.code === "FORBIDDEN" ? 403 : 400;
  return NextResponse.json({ error: e.message }, { status });
}
