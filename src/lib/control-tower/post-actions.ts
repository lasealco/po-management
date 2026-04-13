import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, userHasRoleNamed } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

import { writeCtAudit } from "./audit";

type Json = Record<string, unknown>;

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

async function assertShipmentTenant(shipmentId: string, tenantId: string) {
  const row = await prisma.shipment.findFirst({
    where: { id: shipmentId, order: { tenantId } },
    select: { id: true },
  });
  return Boolean(row);
}

export async function handleControlTowerPost(
  tenantId: string,
  body: Json,
): Promise<Response> {
  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }
  if (await userHasRoleNamed(actorId, "Supplier portal")) {
    return NextResponse.json(
      { error: "Customer users cannot modify control tower data." },
      { status: 403 },
    );
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (!action) return bad("action is required");

  if (action === "add_ct_reference") {
    const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId : "";
    const refType = typeof body.refType === "string" ? body.refType.trim() : "";
    const refValue = typeof body.refValue === "string" ? body.refValue.trim() : "";
    if (!shipmentId || !refType || !refValue) return bad("shipmentId, refType, refValue required");
    if (!(await assertShipmentTenant(shipmentId, tenantId))) return bad("Shipment not found", 404);
    const row = await prisma.ctShipmentReference.create({
      data: { shipmentId, refType, refValue },
    });
    await writeCtAudit({
      tenantId,
      shipmentId,
      entityType: "CtShipmentReference",
      entityId: row.id,
      action: "create",
      actorUserId: actorId,
      payload: { refType, refValue },
    });
    return NextResponse.json({ ok: true, id: row.id });
  }

  if (action === "upsert_ct_tracking_milestone") {
    const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!shipmentId || !code) return bad("shipmentId and code required");
    if (!(await assertShipmentTenant(shipmentId, tenantId))) return bad("Shipment not found", 404);
    const id = typeof body.id === "string" ? body.id : "";
    const label = typeof body.label === "string" ? body.label : null;
    const parseOpt = (v: unknown) => {
      if (v === null) return null;
      if (typeof v !== "string" || !v.trim()) return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? "invalid" : d;
    };
    const plannedAt = parseOpt(body.plannedAt);
    const predictedAt = parseOpt(body.predictedAt);
    const actualAt = parseOpt(body.actualAt);
    if (plannedAt === "invalid" || predictedAt === "invalid" || actualAt === "invalid") {
      return bad("Invalid date");
    }
    const sourceType =
      typeof body.sourceType === "string" && body.sourceType.trim()
        ? body.sourceType.trim()
        : "MANUAL";
    const sourceRef = typeof body.sourceRef === "string" ? body.sourceRef : null;
    const confidence =
      typeof body.confidence === "number" && Number.isFinite(body.confidence)
        ? Math.min(100, Math.max(0, Math.floor(body.confidence)))
        : null;
    const notes = typeof body.notes === "string" ? body.notes : null;

    let row;
    if (id) {
      const existing = await prisma.ctTrackingMilestone.findFirst({
        where: { id, tenantId, shipmentId },
      });
      if (!existing) return bad("Milestone not found", 404);
      row = await prisma.ctTrackingMilestone.update({
        where: { id },
        data: {
          label,
          plannedAt: plannedAt === undefined ? undefined : plannedAt,
          predictedAt: predictedAt === undefined ? undefined : predictedAt,
          actualAt: actualAt === undefined ? undefined : actualAt,
          sourceType,
          sourceRef,
          confidence,
          notes,
          updatedById: actorId,
        },
      });
    } else {
      row = await prisma.ctTrackingMilestone.create({
        data: {
          tenantId,
          shipmentId,
          code,
          label,
          plannedAt: plannedAt ?? null,
          predictedAt: predictedAt ?? null,
          actualAt: actualAt ?? null,
          sourceType,
          sourceRef,
          confidence,
          notes,
          updatedById: actorId,
        },
      });
    }
    await writeCtAudit({
      tenantId,
      shipmentId,
      entityType: "CtTrackingMilestone",
      entityId: row.id,
      action: id ? "update" : "create",
      actorUserId: actorId,
      payload: { code },
    });
    return NextResponse.json({ ok: true, id: row.id });
  }

  if (action === "create_ct_note") {
    const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId : "";
    const text = typeof body.body === "string" ? body.body.trim() : "";
    const visibility =
      body.visibility === "SHARED" ? "SHARED" : ("INTERNAL" as const);
    if (!shipmentId || !text) return bad("shipmentId and body required");
    if (!(await assertShipmentTenant(shipmentId, tenantId))) return bad("Shipment not found", 404);
    const row = await prisma.ctShipmentNote.create({
      data: {
        tenantId,
        shipmentId,
        body: text,
        visibility,
        createdById: actorId,
      },
    });
    await writeCtAudit({
      tenantId,
      shipmentId,
      entityType: "CtShipmentNote",
      entityId: row.id,
      action: "create",
      actorUserId: actorId,
    });
    return NextResponse.json({ ok: true, id: row.id });
  }

  if (action === "register_ct_document") {
    const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId : "";
    const blobUrl = typeof body.blobUrl === "string" ? body.blobUrl.trim() : "";
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "file";
    const docType = typeof body.docType === "string" ? body.docType.trim() : "OTHER";
    const visibility =
      body.visibility === "CUSTOMER_SHAREABLE"
        ? "CUSTOMER_SHAREABLE"
        : ("INTERNAL" as const);
    if (!shipmentId || !blobUrl) return bad("shipmentId and blobUrl required");
    if (!(await assertShipmentTenant(shipmentId, tenantId))) return bad("Shipment not found", 404);
    const row = await prisma.ctShipmentDocument.create({
      data: {
        tenantId,
        shipmentId,
        docType,
        fileName,
        blobUrl,
        visibility,
        uploadedById: actorId,
      },
    });
    await writeCtAudit({
      tenantId,
      shipmentId,
      entityType: "CtShipmentDocument",
      entityId: row.id,
      action: "create",
      actorUserId: actorId,
      payload: { docType, fileName, visibility },
    });
    return NextResponse.json({ ok: true, id: row.id });
  }

  if (action === "create_ct_financial_snapshot") {
    const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId : "";
    if (!shipmentId) return bad("shipmentId required");
    if (!(await assertShipmentTenant(shipmentId, tenantId))) return bad("Shipment not found", 404);
    const dec = (v: unknown) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      if (!Number.isFinite(n)) return "invalid";
      return new Prisma.Decimal(n);
    };
    const customerVisibleCost = dec(body.customerVisibleCost);
    const internalCost = dec(body.internalCost);
    const internalRevenue = dec(body.internalRevenue);
    const internalNet = dec(body.internalNet);
    const internalMarginPct = dec(body.internalMarginPct);
    if (
      customerVisibleCost === "invalid" ||
      internalCost === "invalid" ||
      internalRevenue === "invalid" ||
      internalNet === "invalid" ||
      internalMarginPct === "invalid"
    ) {
      return bad("Invalid numeric field");
    }
    const currency =
      typeof body.currency === "string" && body.currency.trim()
        ? body.currency.trim().slice(0, 3).toUpperCase()
        : "USD";
    const row = await prisma.ctShipmentFinancialSnapshot.create({
      data: {
        tenantId,
        shipmentId,
        customerVisibleCost,
        internalCost,
        internalRevenue,
        internalNet,
        internalMarginPct,
        currency,
        createdById: actorId,
      },
    });
    await writeCtAudit({
      tenantId,
      shipmentId,
      entityType: "CtShipmentFinancialSnapshot",
      entityId: row.id,
      action: "create",
      actorUserId: actorId,
    });
    return NextResponse.json({ ok: true, id: row.id });
  }

  if (action === "create_ct_alert") {
    const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const type = typeof body.type === "string" ? body.type.trim() : "MANUAL";
    const severity =
      body.severity === "INFO" || body.severity === "CRITICAL" ? body.severity : "WARN";
    const bodyText = typeof body.body === "string" ? body.body : null;
    if (!shipmentId || !title) return bad("shipmentId and title required");
    if (!(await assertShipmentTenant(shipmentId, tenantId))) return bad("Shipment not found", 404);
    const row = await prisma.ctAlert.create({
      data: {
        tenantId,
        shipmentId,
        type,
        severity,
        title,
        body: bodyText,
      },
    });
    await writeCtAudit({
      tenantId,
      shipmentId,
      entityType: "CtAlert",
      entityId: row.id,
      action: "create",
      actorUserId: actorId,
    });
    return NextResponse.json({ ok: true, id: row.id });
  }

  if (action === "acknowledge_ct_alert") {
    const alertId = typeof body.alertId === "string" ? body.alertId : "";
    if (!alertId) return bad("alertId required");
    const alert = await prisma.ctAlert.findFirst({
      where: { id: alertId, tenantId },
    });
    if (!alert) return bad("Alert not found", 404);
    await prisma.ctAlert.update({
      where: { id: alertId },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedAt: new Date(),
        acknowledgedById: actorId,
      },
    });
    await writeCtAudit({
      tenantId,
      shipmentId: alert.shipmentId,
      entityType: "CtAlert",
      entityId: alertId,
      action: "acknowledge",
      actorUserId: actorId,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "assign_ct_alert_owner") {
    const alertId = typeof body.alertId === "string" ? body.alertId : "";
    const ownerUserId =
      body.ownerUserId === null || body.ownerUserId === ""
        ? null
        : typeof body.ownerUserId === "string"
          ? body.ownerUserId
          : undefined;
    if (!alertId || ownerUserId === undefined) return bad("alertId and ownerUserId (or null) required");
    const alert = await prisma.ctAlert.findFirst({
      where: { id: alertId, tenantId },
    });
    if (!alert) return bad("Alert not found", 404);
    if (ownerUserId) {
      const u = await prisma.user.findFirst({
        where: { id: ownerUserId, tenantId },
        select: { id: true },
      });
      if (!u) return bad("Owner user not in tenant", 404);
    }
    await prisma.ctAlert.update({
      where: { id: alertId },
      data: { ownerUserId },
    });
    await writeCtAudit({
      tenantId,
      shipmentId: alert.shipmentId,
      entityType: "CtAlert",
      entityId: alertId,
      action: "assign_owner",
      actorUserId: actorId,
      payload: { ownerUserId },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_ct_exception") {
    const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId : "";
    const type = typeof body.type === "string" ? body.type.trim() : "";
    if (!shipmentId || !type) return bad("shipmentId and type required");
    if (!(await assertShipmentTenant(shipmentId, tenantId))) return bad("Shipment not found", 404);
    const severity =
      body.severity === "INFO" || body.severity === "CRITICAL" ? body.severity : "WARN";
    const ownerUserId =
      typeof body.ownerUserId === "string" && body.ownerUserId ? body.ownerUserId : null;
    if (ownerUserId) {
      const u = await prisma.user.findFirst({
        where: { id: ownerUserId, tenantId },
        select: { id: true },
      });
      if (!u) return bad("Owner user not in tenant", 404);
    }
    const row = await prisma.ctException.create({
      data: {
        tenantId,
        shipmentId,
        type,
        severity,
        ownerUserId,
      },
    });
    await writeCtAudit({
      tenantId,
      shipmentId,
      entityType: "CtException",
      entityId: row.id,
      action: "create",
      actorUserId: actorId,
    });
    return NextResponse.json({ ok: true, id: row.id });
  }

  if (action === "update_ct_exception") {
    const exceptionId = typeof body.exceptionId === "string" ? body.exceptionId : "";
    if (!exceptionId) return bad("exceptionId required");
    const ex = await prisma.ctException.findFirst({
      where: { id: exceptionId, tenantId },
    });
    if (!ex) return bad("Exception not found", 404);
    const status = body.status;
    const allowed = new Set(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
    if (typeof status !== "string" || !allowed.has(status)) {
      return bad("status must be OPEN | IN_PROGRESS | RESOLVED | CLOSED");
    }
    const rootCause = typeof body.rootCause === "string" ? body.rootCause : undefined;
    const resolvedAt =
      status === "RESOLVED" || status === "CLOSED"
        ? new Date()
        : body.resolvedAt === null
          ? null
          : typeof body.resolvedAt === "string"
            ? new Date(body.resolvedAt)
            : undefined;
    await prisma.ctException.update({
      where: { id: exceptionId },
      data: {
        status: status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED",
        ...(rootCause !== undefined ? { rootCause } : {}),
        ...(resolvedAt !== undefined ? { resolvedAt } : {}),
      },
    });
    await writeCtAudit({
      tenantId,
      shipmentId: ex.shipmentId,
      entityType: "CtException",
      entityId: exceptionId,
      action: "update",
      actorUserId: actorId,
      payload: { status },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "save_ct_filter") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return bad("name required");
    const filtersJson = body.filtersJson;
    if (filtersJson === undefined || typeof filtersJson !== "object" || filtersJson === null) {
      return bad("filtersJson object required");
    }
    const row = await prisma.ctSavedFilter.create({
      data: {
        tenantId,
        userId: actorId,
        name,
        filtersJson: filtersJson as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ ok: true, id: row.id });
  }

  if (action === "delete_ct_filter") {
    const filterId = typeof body.filterId === "string" ? body.filterId : "";
    if (!filterId) return bad("filterId required");
    const row = await prisma.ctSavedFilter.findFirst({
      where: { id: filterId, tenantId, userId: actorId },
    });
    if (!row) return bad("Saved filter not found", 404);
    await prisma.ctSavedFilter.delete({ where: { id: filterId } });
    return NextResponse.json({ ok: true });
  }

  return bad(`Unknown action: ${action}`, 400);
}
