import { NextResponse } from "next/server";

import { runSlaEscalationsAllTenants } from "@/lib/control-tower/sla-escalation";

export const dynamic = "force-dynamic";

/**
 * Scheduled sweep for SLA breach follow-ups (internal notes + escalation alerts).
 * Secure with `CRON_SECRET`: send `Authorization: Bearer <CRON_SECRET>`.
 * Vercel Cron invokes GET; POST supported for manual or external schedulers.
 * On Vercel Hobby, crons run at most once per day (see `vercel.json` schedule).
 * Optional: set `CONTROL_TOWER_SYSTEM_ACTOR_EMAIL` to an active tenant user for audit/note attribution.
 */
async function handleCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runSlaEscalationsAllTenants();
  return NextResponse.json({ ok: true, ...summary });
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
