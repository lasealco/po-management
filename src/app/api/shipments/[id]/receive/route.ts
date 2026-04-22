import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { actorIsSupplierPortalRestricted, getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

type ReceiveLineInput = { shipmentItemId: string; quantityReceived: string };
type ReceiveBody = { lines?: ReceiveLineInput[] };

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "edit");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active demo actor.", code: "FORBIDDEN", status: 403 });
  }
  const isSupplier = await actorIsSupplierPortalRestricted(actorId);
  if (isSupplier) {
    return toApiErrorResponse({
      error: "Supplier users cannot mark buyer receipts.",
      code: "FORBIDDEN",
      status: 403,
    });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const { id: shipmentId } = await context.params;
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, order: { tenantId: tenant.id } },
    include: { items: true },
  });
  if (!shipment) {
    return toApiErrorResponse({ error: "Shipment not found.", code: "NOT_FOUND", status: 404 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as ReceiveBody;
  const lineMap = new Map<string, number>();
  for (const row of input.lines ?? []) {
    const qty = Number(row.quantityReceived);
    if (!Number.isFinite(qty) || qty <= 0) {
      return toApiErrorResponse({
        error: "quantityReceived must be positive.",
        code: "BAD_INPUT",
        status: 400,
      });
    }
    lineMap.set(row.shipmentItemId, qty);
  }
  const hasExplicitLines = lineMap.size > 0;

  await prisma.$transaction(async (tx) => {
    for (const item of shipment.items) {
      const remaining = Number(item.quantityShipped) - Number(item.quantityReceived);
      if (remaining <= 0) continue;
      const delta = hasExplicitLines
        ? (lineMap.get(item.id) ?? 0)
        : remaining;
      const capped = Math.min(remaining, delta);
      if (capped <= 0) continue;
      await tx.shipmentItem.update({
        where: { id: item.id },
        data: {
          quantityReceived: (Number(item.quantityReceived) + capped).toString(),
        },
      });
    }

    const latest = await tx.shipmentItem.findMany({
      where: { shipmentId: shipment.id },
      select: { quantityShipped: true, quantityReceived: true },
    });
    const fullyReceived = latest.every(
      (row) => Number(row.quantityReceived) >= Number(row.quantityShipped),
    );
    if (fullyReceived) {
      const now = new Date();
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: "RECEIVED", receivedAt: now },
      });
      await tx.shipmentMilestone.create({
        data: {
          shipmentId: shipment.id,
          code: "RECEIVED",
          source: "INTERNAL",
          actualAt: now,
          updatedById: actorId,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
