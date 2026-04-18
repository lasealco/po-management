import { NextResponse } from "next/server";

import { runControlTowerReportScheduleCron } from "@/lib/control-tower/report-schedule-delivery";

export const dynamic = "force-dynamic";

/**
 * Hourly sweep for **Control Tower saved report** email schedules (`CtReportSchedule`).
 * `vercel.json` uses `5 * * * *` (UTC); Pro allows sub-daily crons. On Hobby, use a single daily
 * cron instead (see git history / docs if you downgrade).
 *
 * Secure with `CRON_SECRET`: `Authorization: Bearer <CRON_SECRET>`.
 *
 * Configure outbound mail with `RESEND_API_KEY` + `CONTROL_TOWER_REPORTS_EMAIL_FROM`
 * (verified sender in Resend). Each send attaches **CSV** (full series) and a **PDF** summary.
 * Without mail env, runs still execute the report and set `lastError` to note deferred email.
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

  const summary = await runControlTowerReportScheduleCron();
  return NextResponse.json({ ok: true, ...summary });
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
