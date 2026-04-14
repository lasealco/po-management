import { NextResponse } from "next/server";

import { runSlaEscalationsAllTenants } from "@/lib/control-tower/sla-escalation";

export const dynamic = "force-dynamic";

/**
 * Scheduled sweep for SLA breach follow-ups (internal notes + escalation alerts).
 * Secure with `CRON_SECRET`: send `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: Request) {
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
