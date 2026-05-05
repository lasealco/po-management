import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { persistDockYardMilestoneWithDetentionAudit } from "@/lib/wms/dock-yard-milestone-tx";
import { trailerChecklistAllowsDepart } from "@/lib/wms/dock-trailer-checklist";
import {
  verifyTmsWebhookBearer,
  verifyTmsWebhookBodySignature,
} from "@/lib/wms/tms-webhook-stub";
import { parseYardGeofenceWebhookPayload } from "@/lib/wms/yard-geofence-webhook-bf74";

export const dynamic = "force-dynamic";

function isIdempotencyConflict(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as Error).message === "IDEMPOTENCY_CONFLICT";
}

export async function POST(request: Request) {
  const secret = process.env.WMS_YARD_GEOFENCE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return toApiErrorResponse({
      error: "Yard geofence webhook not configured.",
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
  }
  if (!verifyTmsWebhookBearer(request.headers.get("authorization"), secret)) {
    return toApiErrorResponse({ error: "Unauthorized.", code: "UNAUTHORIZED", status: 401 });
  }

  const rawBody = await request.text();
  const hmacSecret = process.env.WMS_YARD_GEOFENCE_WEBHOOK_HMAC_SECRET?.trim();
  if (hmacSecret) {
    const sig =
      request.headers.get("x-yard-geofence-signature") ??
      request.headers.get("X-Yard-Geofence-Signature");
    if (!verifyTmsWebhookBodySignature(sig, rawBody, hmacSecret)) {
      return toApiErrorResponse({
        error: "Invalid or missing X-Yard-Geofence-Signature.",
        code: "UNAUTHORIZED",
        status: 401,
      });
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }

  const parsed = parseYardGeofenceWebhookPayload(body);
  if (!parsed) {
    return toApiErrorResponse({
      error: "dockAppointmentId, externalEventId, and yardMilestone (GATE_IN | AT_DOCK | DEPARTED) required; optional schemaVersion must be bf74.v1.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const tenant = await prisma.tenant.findFirst({
    where: { slug: parsed.tenantSlug },
    select: { id: true },
  });
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const existingRow = await prisma.wmsDockAppointment.findFirst({
    where: { id: parsed.dockAppointmentId, tenantId: tenant.id },
    select: {
      id: true,
      status: true,
      shipmentId: true,
      createdById: true,
      doorCode: true,
      trailerChecklistJson: true,
      gateCheckedInAt: true,
      atDockAt: true,
    },
  });
  if (!existingRow) {
    return toApiErrorResponse({ error: "Appointment not found.", code: "NOT_FOUND", status: 404 });
  }
  if (existingRow.status !== "SCHEDULED") {
    return toApiErrorResponse({
      error: "Only SCHEDULED appointments accept yard geofence milestones.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const rawOccurred = parsed.yardOccurredAt?.trim();
  const occurredAt = rawOccurred ? new Date(rawOccurred) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return toApiErrorResponse({ error: "Invalid yardOccurredAt.", code: "BAD_INPUT", status: 400 });
  }

  const milestone = parsed.yardMilestone;

  if (
    milestone === "AT_DOCK" &&
    process.env.WMS_BF38_REQUIRE_DOOR_BEFORE_AT_DOCK === "1" &&
    !existingRow.doorCode?.trim()
  ) {
    return toApiErrorResponse({
      error:
        "Assign door (BF-38 doorCode) before recording AT_DOCK, or unset WMS_BF38_REQUIRE_DOOR_BEFORE_AT_DOCK.",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  if (milestone === "DEPARTED" && !trailerChecklistAllowsDepart(existingRow.trailerChecklistJson)) {
    return toApiErrorResponse({
      error: "Complete required trailer checklist items before recording DEPARTED (BF-38).",
      code: "BAD_INPUT",
      status: 400,
    });
  }

  const tenantDetentionRow = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { wmsDockDetentionPolicyJson: true },
  });

  let duplicate = false;

  try {
    await prisma.$transaction(async (tx) => {
      const prior = await tx.wmsYardGeofenceWebhookReceipt.findUnique({
        where: {
          tenantId_externalEventId: {
            tenantId: tenant.id,
            externalEventId: parsed.externalEventId,
          },
        },
      });
      if (prior) {
        if (prior.dockAppointmentId !== parsed.dockAppointmentId) {
          throw Object.assign(new Error("IDEMPOTENCY_CONFLICT"), { httpStatus: 409 });
        }
        duplicate = true;
        return;
      }
      try {
        await tx.wmsYardGeofenceWebhookReceipt.create({
          data: {
            tenantId: tenant.id,
            externalEventId: parsed.externalEventId,
            dockAppointmentId: existingRow.id,
          },
        });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) {
          throw e;
        }
        const raced = await tx.wmsYardGeofenceWebhookReceipt.findUnique({
          where: {
            tenantId_externalEventId: {
              tenantId: tenant.id,
              externalEventId: parsed.externalEventId,
            },
          },
        });
        if (!raced || raced.dockAppointmentId !== existingRow.id) {
          throw Object.assign(new Error("IDEMPOTENCY_CONFLICT"), { httpStatus: 409 });
        }
        duplicate = true;
        return;
      }

      await persistDockYardMilestoneWithDetentionAudit(tx, {
        tenantId: tenant.id,
        appointment: {
          id: existingRow.id,
          shipmentId: existingRow.shipmentId,
          gateCheckedInAt: existingRow.gateCheckedInAt,
          atDockAt: existingRow.atDockAt,
        },
        milestone,
        occurredAt,
        actorUserId: existingRow.createdById,
        detentionPolicyJson: tenantDetentionRow?.wmsDockDetentionPolicyJson,
        primaryAudit: {
          action: "yard_geofence_webhook_bf74",
          payload: {
            schemaVersion: parsed.schemaVersion,
            externalEventId: parsed.externalEventId,
            yardMilestone: milestone,
            yardOccurredAt: rawOccurred ?? occurredAt.toISOString(),
            hmacEnforced: Boolean(hmacSecret),
          },
        },
      });
    });
  } catch (err: unknown) {
    if (isIdempotencyConflict(err)) {
      return toApiErrorResponse({
        error: "externalEventId already recorded for a different dock appointment.",
        code: "CONFLICT",
        status: 409,
      });
    }
    throw err;
  }

  return duplicate
    ? NextResponse.json({ ok: true, duplicate: true })
    : NextResponse.json({ ok: true });
}
