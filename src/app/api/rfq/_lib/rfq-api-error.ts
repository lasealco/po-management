import { NextResponse } from "next/server";

import { RfqRepoError } from "@/lib/rfq/rfq-repo-error";

export function jsonFromRfqError(e: unknown): NextResponse | null {
  if (!(e instanceof RfqRepoError)) return null;
  const status =
    e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400;
  return NextResponse.json({ error: e.message }, { status });
}
