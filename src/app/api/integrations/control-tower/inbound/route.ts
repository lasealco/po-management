import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { writeCtAudit } from "@/lib/control-tower/audit";
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
 * Minimal inbound integration stub: verifies a shared secret and appends a
 * tenant-scoped `CtAuditLog` row (optionally tied to a shipment).
 *
 * Auth: `Authorization: Bearer <CONTROL_TOWER_INBOUND_WEBHOOK_SECRET>` or
 * header `x-ct-inbound-secret: <secret>`.
 *
 * Body JSON:
 * - `event` (string, optional, default "inbound_webhook") — stored as audit action
 * - `shipmentId` (string, optional) — must belong to demo tenant when set
 * - `note` (string, optional) — truncated, stored in audit payload
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
  const event = typeof obj.event === "string" && obj.event.trim() ? obj.event.trim().slice(0, 120) : "inbound_webhook";
  const shipmentId = typeof obj.shipmentId === "string" ? obj.shipmentId.trim() : "";
  const note = typeof obj.note === "string" ? obj.note.trim().slice(0, 4000) : "";

  let shipmentScoped: string | null = null;
  if (shipmentId) {
    const row = await prisma.shipment.findFirst({
      where: { id: shipmentId, order: { tenantId: tenant.id } },
      select: { id: true },
    });
    if (!row) {
      return NextResponse.json({ error: "Shipment not found for this tenant." }, { status: 404 });
    }
    shipmentScoped = row.id;
  }

  const actor = await prisma.user.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!actor) {
    return NextResponse.json({ error: "No active user in tenant to attribute audit entry." }, { status: 500 });
  }

  const entityId = `wh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await writeCtAudit({
    tenantId: tenant.id,
    shipmentId: shipmentScoped,
    entityType: "EXTERNAL_WEBHOOK",
    entityId,
    action: event,
    actorUserId: actor.id,
    payload: {
      note: note || undefined,
      receivedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({ ok: true, entityId, shipmentId: shipmentScoped });
}
