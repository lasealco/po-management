import { NextResponse } from "next/server";

import { TariffRepoError } from "@/lib/tariff/tariff-repo-error";

export type TariffApiErrorBody = { error: string; code: TariffRepoError["code"] | "BAD_INPUT" };

export function toTariffApiErrorBody(
  error: string,
  code: TariffRepoError["code"] | "BAD_INPUT",
): TariffApiErrorBody {
  return { error, code };
}

export function jsonFromTariffError(e: unknown): NextResponse | null {
  if (!(e instanceof TariffRepoError)) return null;
  const status =
    e.code === "NOT_FOUND"
      ? 404
      : e.code === "TENANT_MISMATCH"
        ? 403
        : e.code === "VERSION_FROZEN" || e.code === "CONFLICT"
          ? 409
          : e.code === "BAD_INPUT"
            ? 400
            : 400;
  return NextResponse.json(toTariffApiErrorBody(e.message, e.code), { status });
}
