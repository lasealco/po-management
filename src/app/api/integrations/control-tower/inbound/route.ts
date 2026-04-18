import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { processControlTowerInboundWebhook } from "@/lib/control-tower/inbound-webhook";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Constant-time compare of two strings via SHA-256 digests (same length). */
function constantTimeEqString(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Inbound integration: verifies a shared secret, optional **idempotent** processing,
 * optional **`CtTrackingMilestone`** upsert (`sourceType: INTEGRATION`), and an
 * `EXTERNAL_WEBHOOK` audit row.
 *
 * Auth: `Authorization: Bearer <CONTROL_TOWER_INBOUND_WEBHOOK_SECRET>` or
 * header `x-ct-inbound-secret: <secret>`.
 *
 * Body JSON (see `processControlTowerInboundWebhook` in `@/lib/control-tower/inbound-webhook`):
 * - `idempotencyKey` (optional) — replays return `idempotentReplay: true` and the first response body.
 * - `payloadFormat` — `canonical` (default), `generic_carrier_v1`, **`carrier_webhook_v1`**, **`tms_event_v1`**, or **`visibility_flat_v1`**.
 * - `event`, `shipmentId`, `note` — same as the original stub.
 * - `milestone` (canonical only) — `{ code, actualAt?, plannedAt?, predictedAt?, label?, notes?, sourceRef? }`.
 * - `carrierPayload` (`generic_carrier_v1`) — `{ shipment_id, event_code, event_time, message?, external_ref? }`.
 * - `data` (`carrier_webhook_v1`) — non-empty array (default max **50** rows, override env **`CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS`** up to **200**); each element is read like `carrierPayload` (`shipment_id` \| `shipmentId`, `event_code` \| `eventCode`, `event_time` \| `eventTime` \| `occurredAt`, optional `message`, `external_ref` \| `externalRef`). Response includes `rows[]` per index and **`maxBatchRows`** (resolved cap); top-level `shipmentId` / `milestoneId` mirror the first successful row. **400** when every row fails (same spirit as invalid single-row payloads). With `idempotencyKey`, each row uses key suffix `:index` for milestone dedupe; replay is stored only on **200**.
 * - `tmsPayload` (`tms_event_v1`) — `{ shipmentId|shipment_id, milestoneCode|milestone_code|eventType|event_type, actualAt|event_timestamp|occurred_at, plannedAt?, predictedAt?, label?, remarks|message?, correlationId|transaction_id? }`.
 * - `visibilityPayload` (`visibility_flat_v1`) — flat partner object: `shipmentId|shipment_id|shipmentCuid`, code via `milestoneCode|event_code|statusCode`, time via `occurredAt|event_time|timestamp|visibilityTimestamp`, optional `plannedAt`, `predictedAt`, `label`, `description|remarks|message`, `trackingId|correlationId` as source ref.
 */
export async function POST(request: Request) {
  const secret = process.env.CONTROL_TOWER_INBOUND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook not configured. Set CONTROL_TOWER_INBOUND_WEBHOOK_SECRET." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const headerSecret = request.headers.get("x-ct-inbound-secret")?.trim() ?? "";
  const token = bearer || headerSecret;
  if (!token || !constantTimeEqString(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const actor = await prisma.user.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!actor) {
    return NextResponse.json({ error: "No active user in tenant to attribute audit entry." }, { status: 500 });
  }

  const out = await processControlTowerInboundWebhook({
    tenantId: tenant.id,
    actorUserId: actor.id,
    body: obj,
  });
  return NextResponse.json(out.body, { status: out.status });
}
