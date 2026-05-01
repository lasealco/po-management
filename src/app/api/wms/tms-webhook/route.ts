import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  DOCK_TMS_LIMITS,
  truncateDockTransportField,
} from "@/lib/wms/dock-appointment";
import {
  parseTmsWebhookPayload,
  verifyTmsWebhookBearer,
  verifyTmsWebhookBodySignature,
} from "@/lib/wms/tms-webhook-stub";

export const dynamic = "force-dynamic";

function isIdempotencyConflict(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as Error).message === "IDEMPOTENCY_CONFLICT";
}

export async function POST(request: Request) {
  const secret = process.env.TMS_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return toApiErrorResponse({
      error: "TMS webhook not configured.",
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
  }
  if (!verifyTmsWebhookBearer(request.headers.get("authorization"), secret)) {
    return toApiErrorResponse({ error: "Unauthorized.", code: "UNAUTHORIZED", status: 401 });
  }

  const rawBody = await request.text();
  const hmacSecret = process.env.TMS_WEBHOOK_HMAC_SECRET?.trim();
  if (hmacSecret) {
    const sig =
      request.headers.get("x-tms-signature") ?? request.headers.get("X-TMS-Signature");
    if (!verifyTmsWebhookBodySignature(sig, rawBody, hmacSecret)) {
      return toApiErrorResponse({
        error: "Invalid or missing X-TMS-Signature.",
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

  const parsed = parseTmsWebhookPayload(body);
  if (!parsed) {
    return toApiErrorResponse({ error: "dockAppointmentId required.", code: "BAD_INPUT", status: 400 });
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
    },
  });
  if (!existingRow) {
    return toApiErrorResponse({ error: "Appointment not found.", code: "NOT_FOUND", status: 404 });
  }

  const updateRefs: Prisma.WmsDockAppointmentUpdateInput = {
    tmsLastWebhookAt: new Date(),
  };

  if (parsed.tmsLoadId !== undefined) {
    updateRefs.tmsLoadId =
      parsed.tmsLoadId === null
        ? null
        : truncateDockTransportField(parsed.tmsLoadId, DOCK_TMS_LIMITS.tmsLoadId);
  }
  if (parsed.tmsCarrierBookingRef !== undefined) {
    updateRefs.tmsCarrierBookingRef =
      parsed.tmsCarrierBookingRef === ""
        ? null
        : truncateDockTransportField(parsed.tmsCarrierBookingRef, DOCK_TMS_LIMITS.tmsCarrierBookingRef);
  }

  let milestonePatch: Prisma.WmsDockAppointmentUpdateInput = {};
  if (parsed.yardMilestone) {
    if (existingRow.status !== "SCHEDULED") {
      return toApiErrorResponse({
        error: "yardMilestone only allowed for SCHEDULED appointments.",
        code: "BAD_INPUT",
        status: 400,
      });
    }
    const rawOccurred = parsed.yardOccurredAt?.trim();
    const occurredAt = rawOccurred ? new Date(rawOccurred) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      return toApiErrorResponse({ error: "Invalid yardOccurredAt.", code: "BAD_INPUT", status: 400 });
    }
    milestonePatch =
      parsed.yardMilestone === "GATE_IN"
        ? { gateCheckedInAt: occurredAt }
        : parsed.yardMilestone === "AT_DOCK"
          ? { atDockAt: occurredAt }
          : { departedAt: occurredAt, status: "COMPLETED" };
  }

  let duplicate = false;

  try {
    await prisma.$transaction(async (tx) => {
      if (parsed.externalEventId) {
        const prior = await tx.wmsTmsWebhookReceipt.findUnique({
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
          await tx.wmsTmsWebhookReceipt.create({
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
          const raced = await tx.wmsTmsWebhookReceipt.findUnique({
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
      }

      await tx.wmsDockAppointment.update({
        where: { id: existingRow.id },
        data: { ...updateRefs, ...milestonePatch },
      });
      await tx.ctAuditLog.create({
        data: {
          tenantId: tenant.id,
          shipmentId: existingRow.shipmentId,
          entityType: "WMS_DOCK_APPOINTMENT",
          entityId: existingRow.id,
          action: "tms_webhook_stub",
          payload: {
            externalEventId: parsed.externalEventId ?? undefined,
            tmsLoadId: parsed.tmsLoadId ?? undefined,
            tmsCarrierBookingRef: parsed.tmsCarrierBookingRef ?? undefined,
            yardMilestone: parsed.yardMilestone ?? undefined,
            yardOccurredAt: parsed.yardOccurredAt ?? undefined,
            hmacEnforced: Boolean(hmacSecret),
          },
          actorUserId: existingRow.createdById,
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
