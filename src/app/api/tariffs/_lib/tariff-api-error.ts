import { NextResponse } from "next/server";

import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

export function jsonFromTariffError(e: unknown): NextResponse | null {
  if (!(e instanceof TariffRepoError)) return null;
  const status =
    e.code === "NOT_FOUND"
      ? 404
      : e.code === "TENANT_MISMATCH"
        ? 403
        : e.code === "VERSION_FROZEN" || e.code === "CONFLICT"
          ? 409
          : 400;
  return NextResponse.json({ error: e.message }, { status });
}
