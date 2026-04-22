import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  actorIsSupplierPortalRestricted,
  getActorUserId,
  requireApiGrant,
  userHasRoleNamed,
  userIsSuperuser,
} from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

type MilestoneBody = {
  code?:
    | "DEPARTED"
    | "ARRIVED"
    | "DELIVERED"
    | "RECEIVED"
    | "ASN_VALIDATED"
    | "BOOKING_CONFIRMED";
  plannedAt?: string | null;
  actualAt?: string | null;
  note?: string | null;
};

function parseDate(v: string | null | undefined) {
  if (!v || !v.trim()) return null;
  const d = new Date(`${v.trim()}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "invalid";
  return d;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "transition");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active demo actor.", code: "FORBIDDEN", status: 403 });
  }
  const isSupplier = await actorIsSupplierPortalRestricted(actorId);
  if (isSupplier) {
    return toApiErrorResponse({
      error: "Supplier users cannot post logistics milestones.",
      code: "FORBIDDEN",
      status: 403,
    });
  }
  const isSuper = await userIsSuperuser(actorId);
  const isForwarder = await userHasRoleNamed(actorId, "Forwarder");
  const forwarderMilestoneLimited = isForwarder && !isSuper;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const { id: shipmentId } = await context.params;
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, order: { tenantId: tenant.id } },
    select: { id: true, status: true },
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
  const input = (body && typeof body === "object" ? body : {}) as MilestoneBody;
  const code = input.code;
  if (!code) {
    return toApiErrorResponse({ error: "Milestone code is required.", code: "BAD_INPUT", status: 400 });
  }

  const allowedForForwarder = new Set(["DEPARTED", "ARRIVED", "DELIVERED"]);
  if (forwarderMilestoneLimited && !allowedForForwarder.has(code)) {
    return toApiErrorResponse({
      error: "Forwarder users can only post departed/arrived/delivered milestones.",
      code: "FORBIDDEN",
      status: 403,
    });
  }

  const plannedAt = parseDate(input.plannedAt);
  const actualAt = parseDate(input.actualAt);
  if (plannedAt === "invalid" || actualAt === "invalid") {
    return toApiErrorResponse({ error: "Invalid milestone date.", code: "BAD_INPUT", status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.shipmentMilestone.create({
      data: {
        shipmentId: shipment.id,
        code,
        source: forwarderMilestoneLimited ? "FORWARDER" : "INTERNAL",
        plannedAt: plannedAt || null,
        actualAt: actualAt || null,
        note: input.note?.trim() || null,
        updatedById: actorId,
      },
    });

    if (actualAt) {
      if (code === "DEPARTED" || code === "ARRIVED") {
        await tx.shipment.update({
          where: { id: shipment.id },
          data: { status: "IN_TRANSIT" },
        });
      } else if (code === "DELIVERED") {
        await tx.shipment.update({
          where: { id: shipment.id },
          data: { status: "DELIVERED" },
        });
      } else if (code === "RECEIVED") {
        await tx.shipment.update({
          where: { id: shipment.id },
          data: { status: "RECEIVED", receivedAt: actualAt },
        });
      } else if (code === "ASN_VALIDATED") {
        await tx.shipment.update({
          where: { id: shipment.id },
          data: { status: "VALIDATED" },
        });
      } else if (code === "BOOKING_CONFIRMED") {
        await tx.shipment.update({
          where: { id: shipment.id },
          data: { status: "BOOKED" },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
