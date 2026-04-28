import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { controlTowerShipmentAccessWhere, getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  buildCarrierDraft,
  buildCustomerDraft,
  buildRecoveryPlan,
  defaultRecoveryPlaybook,
  parseCtRecoveryState,
  type CtRecoveryExceptionSignal,
  type CtRecoveryShipmentSignal,
} from "@/lib/control-tower/assistant-recovery";

export const dynamic = "force-dynamic";

async function loadRecovery(tenantId: string, shipmentId: string, actorUserId: string) {
  const ctx = await getControlTowerPortalContext(actorUserId);
  const scope = await controlTowerShipmentAccessWhere(tenantId, ctx, actorUserId);
  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, ...scope },
    select: {
      id: true,
      shipmentNo: true,
      trackingNo: true,
      carrier: true,
      customerCrmAccount: { select: { name: true } },
      order: { select: { orderNumber: true } },
      booking: { select: { originCode: true, destinationCode: true, latestEta: true, eta: true, forwarderSupplier: { select: { name: true } } } },
      ctExceptions: {
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 20,
        include: { owner: { select: { id: true, name: true } } },
      },
    },
  });
  if (!shipment) return null;

  const signal: CtRecoveryShipmentSignal = {
    shipmentNo: shipment.shipmentNo,
    trackingNo: shipment.trackingNo,
    carrier: shipment.carrier ?? shipment.booking?.forwarderSupplier?.name ?? null,
    customerName: shipment.customerCrmAccount?.name ?? null,
    originCode: shipment.booking?.originCode ?? null,
    destinationCode: shipment.booking?.destinationCode ?? null,
    latestEta: (shipment.booking?.latestEta ?? shipment.booking?.eta)?.toISOString() ?? null,
    orderNumber: shipment.order.orderNumber,
  };
  const exceptions: CtRecoveryExceptionSignal[] = shipment.ctExceptions.map((exception) => ({
    id: exception.id,
    type: exception.type,
    typeLabel: exception.type,
    severity: exception.severity,
    status: exception.status,
    rootCause: exception.rootCause,
    ownerName: exception.owner?.name ?? null,
    customerImpact: exception.customerImpact,
  }));
  const primary = shipment.ctExceptions.find((exception) => exception.status !== "RESOLVED") ?? shipment.ctExceptions[0] ?? null;
  const primarySignal = exceptions.find((exception) => exception.id === primary?.id) ?? exceptions[0] ?? null;

  return {
    shipment: signal,
    exceptions: shipment.ctExceptions.map((exception) => ({
      id: exception.id,
      type: exception.type,
      severity: exception.severity,
      status: exception.status,
      owner: exception.owner ? { id: exception.owner.id, name: exception.owner.name } : null,
      rootCause: exception.rootCause,
      customerImpact: exception.customerImpact,
      recoveryState: exception.recoveryState,
      recoveryPlan: exception.recoveryPlan,
      carrierDraft: exception.carrierDraft,
      customerDraft: exception.customerDraft,
      playbookSteps: exception.playbookSteps,
      recoveryUpdatedAt: exception.recoveryUpdatedAt?.toISOString() ?? null,
    })),
    generated: {
      recoveryPlan: buildRecoveryPlan({ shipment: signal, exceptions }),
      carrierDraft: buildCarrierDraft({ shipment: signal, exception: primarySignal }),
      customerDraft: buildCustomerDraft({ shipment: signal, exception: primarySignal }),
      playbookSteps: defaultRecoveryPlaybook(),
    },
  };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorUserId = await getActorUserId();
  if (!actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const { id } = await context.params;
  const snapshot = await loadRecovery(tenant.id, id, actorUserId);
  if (!snapshot) return toApiErrorResponse({ error: "Shipment not found.", code: "NOT_FOUND", status: 404 });
  return NextResponse.json(snapshot);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.controltower", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorUserId = await getActorUserId();
  if (!actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const { id: shipmentId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const exceptionId = typeof record.exceptionId === "string" && record.exceptionId.trim() ? record.exceptionId.trim() : "";
  if (!exceptionId) return toApiErrorResponse({ error: "exceptionId is required.", code: "BAD_INPUT", status: 400 });
  const recoveryState = Object.prototype.hasOwnProperty.call(record, "recoveryState")
    ? parseCtRecoveryState(record.recoveryState)
    : null;
  if (Object.prototype.hasOwnProperty.call(record, "recoveryState") && !recoveryState) {
    return toApiErrorResponse({ error: "Invalid recoveryState.", code: "BAD_INPUT", status: 400 });
  }

  const ctx = await getControlTowerPortalContext(actorUserId);
  if (ctx.isRestrictedView) return toApiErrorResponse({ error: "Restricted viewers cannot edit recovery.", code: "FORBIDDEN", status: 403 });
  const scope = await controlTowerShipmentAccessWhere(tenant.id, ctx, actorUserId);
  const shipment = await prisma.shipment.findFirst({ where: { id: shipmentId, ...scope }, select: { id: true, shipmentNo: true } });
  if (!shipment) return toApiErrorResponse({ error: "Shipment not found.", code: "NOT_FOUND", status: 404 });
  const existing = await prisma.ctException.findFirst({ where: { id: exceptionId, tenantId: tenant.id, shipmentId }, select: { id: true } });
  if (!existing) return toApiErrorResponse({ error: "Exception not found.", code: "NOT_FOUND", status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const exception = await tx.ctException.update({
      where: { id: existing.id },
      data: {
        ...(typeof record.rootCause === "string" ? { rootCause: record.rootCause.trim().slice(0, 4_000) || null } : {}),
        ...(typeof record.customerImpact === "string" ? { customerImpact: record.customerImpact.trim().slice(0, 4_000) || null } : {}),
        ...(typeof record.recoveryPlan === "string" ? { recoveryPlan: record.recoveryPlan.trim().slice(0, 12_000) || null } : {}),
        ...(typeof record.carrierDraft === "string" ? { carrierDraft: record.carrierDraft.trim().slice(0, 12_000) || null } : {}),
        ...(typeof record.customerDraft === "string" ? { customerDraft: record.customerDraft.trim().slice(0, 12_000) || null } : {}),
        ...(Array.isArray(record.playbookSteps) ? { playbookSteps: record.playbookSteps } : {}),
        ...(recoveryState ? { recoveryState } : {}),
        recoveryUpdatedAt: new Date(),
      },
      select: { id: true, type: true, recoveryState: true },
    });
    await tx.ctAuditLog.create({
      data: {
        tenantId: tenant.id,
        shipmentId,
        entityType: "CtException",
        entityId: exception.id,
        action: "assistant_recovery_update",
        actorUserId,
        payload: { recoveryState: exception.recoveryState },
      },
    });
    await tx.assistantAuditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId,
        surface: "control_tower_shipment_360",
        prompt: `Update recovery for shipment ${shipment.shipmentNo ?? shipment.id}`,
        answerKind: "ct_recovery_update",
        message: `Updated recovery state ${exception.recoveryState} for exception ${exception.type}.`,
        evidence: [{ label: shipment.shipmentNo ?? shipment.id, href: `/control-tower/shipments/${shipment.id}?tab=recovery` }],
        quality: { mode: "human_review", source: "amp3_control_tower_recovery" },
        objectType: "shipment",
        objectId: shipment.id,
      },
    });
    return exception;
  });
  return NextResponse.json({ ok: true, exception: updated });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.controltower", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const actorUserId = await getActorUserId();
  if (!actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const { id: shipmentId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const action = typeof record.action === "string" ? record.action : "";
  const message = typeof record.message === "string" && record.message.trim() ? record.message.trim().slice(0, 12_000) : "";
  if (!message) return toApiErrorResponse({ error: "message is required.", code: "BAD_INPUT", status: 400 });

  const ctx = await getControlTowerPortalContext(actorUserId);
  if (ctx.isRestrictedView) return toApiErrorResponse({ error: "Restricted viewers cannot queue recovery actions.", code: "FORBIDDEN", status: 403 });
  const scope = await controlTowerShipmentAccessWhere(tenant.id, ctx, actorUserId);
  const shipment = await prisma.shipment.findFirst({ where: { id: shipmentId, ...scope }, select: { id: true, shipmentNo: true } });
  if (!shipment) return toApiErrorResponse({ error: "Shipment not found.", code: "NOT_FOUND", status: 404 });

  if (action !== "queue_carrier_update" && action !== "log_customer_update") {
    return toApiErrorResponse({ error: "Unsupported recovery action.", code: "BAD_INPUT", status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const audit = await tx.assistantAuditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId,
        surface: "control_tower_shipment_360",
        prompt: action === "queue_carrier_update" ? "Queue carrier recovery update" : "Log customer recovery update",
        answerKind: action,
        message:
          action === "queue_carrier_update"
            ? `Queued carrier recovery update for ${shipment.shipmentNo ?? shipment.id}.`
            : `Logged customer recovery update for ${shipment.shipmentNo ?? shipment.id}.`,
        evidence: [{ label: shipment.shipmentNo ?? shipment.id, href: `/control-tower/shipments/${shipment.id}?tab=recovery` }],
        quality: { mode: "human_approved", source: "amp3_control_tower_recovery" },
        objectType: "shipment",
        objectId: shipment.id,
      },
    });
    if (action === "queue_carrier_update") {
      const item = await tx.assistantActionQueueItem.create({
        data: {
          tenantId: tenant.id,
          actorUserId,
          auditEventId: audit.id,
          objectType: "shipment",
          objectId: shipment.id,
          actionId: "ct_carrier_recovery_update",
          actionKind: "copy_text",
          label: `Send carrier recovery update for ${shipment.shipmentNo ?? shipment.id}`,
          description: "Review/copy this carrier update through the approved channel.",
          payload: { shipmentId: shipment.id, message },
        },
        select: { id: true, status: true },
      });
      return { actionQueueItem: item };
    }
    const note = await tx.ctShipmentNote.create({
      data: { tenantId: tenant.id, shipmentId: shipment.id, body: message, visibility: "SHARED", createdById: actorUserId },
      select: { id: true },
    });
    await tx.ctAuditLog.create({
      data: {
        tenantId: tenant.id,
        shipmentId: shipment.id,
        entityType: "CtShipmentNote",
        entityId: note.id,
        action: "assistant_customer_update_logged",
        actorUserId,
        payload: { visibility: "SHARED" },
      },
    });
    return { note };
  });

  return NextResponse.json({ ok: true, ...result });
}
