import { NextResponse } from "next/server";

import { refreshControlTowerFxRatesAllTenants } from "@/lib/control-tower/fx-refresh";

export const dynamic = "force-dynamic";

/**
 * Daily FX refresh (recommended schedule: 03:00 UTC).
 * Secure with `CRON_SECRET`: send `Authorization: Bearer <CRON_SECRET>`.
 */
async function handleCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
