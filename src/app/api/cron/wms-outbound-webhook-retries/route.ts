import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { retryFailedOutboundWebhookDeliveries } from "@/lib/wms/outbound-webhook-dispatch";

export const dynamic = "force-dynamic";

/**
 * BF-45 — retries FAILED BF-44 webhook deliveries whose `nextAttemptAt` is due.
 * Secure with `CRON_SECRET`: `Authorization: Bearer <CRON_SECRET>`.
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

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "25");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(100, Math.max(1, Math.floor(limitRaw)))
    : 25;

  const summary = await retryFailedOutboundWebhookDeliveries(limit);
  return NextResponse.json({ ok: true, ...summary });
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
