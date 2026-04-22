import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { refreshControlTowerFxRatesAllTenants } from "@/lib/control-tower/fx-refresh";

export const dynamic = "force-dynamic";

/**
 * Daily FX refresh (recommended schedule: 03:00 UTC).
 * Secure with `CRON_SECRET`: send `Authorization: Bearer <CRON_SECRET>`.
 */
async function handleCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return toApiErrorResponse({ error: "CRON_SECRET is not configured.", code: "UNAVAILABLE", status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return toApiErrorResponse({ error: "Unauthorized", code: "UNAUTHORIZED", status: 401 });
  }

  const summary = await refreshControlTowerFxRatesAllTenants();
  return NextResponse.json({ ok: true, provider: "frankfurter", ...summary });
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
