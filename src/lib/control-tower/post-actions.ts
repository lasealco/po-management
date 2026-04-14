import { Prisma, type TransportMode } from "@prisma/client";
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
    if (visibility === "INTERNAL") {
      const emailMentions = Array.from(
        new Set(
          text
            .match(/@([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi)
            ?.map((m) => m.slice(1).toLowerCase()) ?? [],
        ),
      );
      if (emailMentions.length) {
        const users = await prisma.user.findMany({
          where: { tenantId, email: { in: emailMentions } },
          select: { id: true, email: true },
        });
        for (const u of users) {
          const mentionAlert = await prisma.ctAlert.create({
            data: {
              tenantId,
              shipmentId,
              type: "COLLAB_MENTION",
              severity: "INFO",
              title: `Mentioned in internal note (${u.email})`,
              body: text.slice(0, 500),
              status: "OPEN",
              ownerUserId: u.id,
            },
          });
          await writeCtAudit({
            tenantId,
            shipmentId,
            entityType: "CtAlert",
            entityId: mentionAlert.id,
            action: "create_mention_alert",
            actorUserId: actorId,
            payload: { mention: u.email, noteId: row.id },
          });
        }
      }
    }
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

  if (action === "close_ct_alert") {
    const alertId = typeof body.alertId === "string" ? body.alertId : "";
    if (!alertId) return bad("alertId required");
    const alert = await prisma.ctAlert.findFirst({
      where: { id: alertId, tenantId },
    });
    if (!alert) return bad("Alert not found", 404);
    await prisma.ctAlert.update({
      where: { id: alertId },
      data: { status: "CLOSED" },
    });
    await writeCtAudit({
      tenantId,
      shipmentId: alert.shipmentId,
      entityType: "CtAlert",
      entityId: alertId,
      action: "close",
      actorUserId: actorId,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "reopen_ct_alert") {
    const alertId = typeof body.alertId === "string" ? body.alertId : "";
    if (!alertId) return bad("alertId required");
    const alert = await prisma.ctAlert.findFirst({
      where: { id: alertId, tenantId },
    });
    if (!alert) return bad("Alert not found", 404);
    await prisma.ctAlert.update({
      where: { id: alertId },
      data: { status: "OPEN" },
    });
    await writeCtAudit({
      tenantId,
      shipmentId: alert.shipmentId,
      entityType: "CtAlert",
      entityId: alertId,
      action: "reopen",
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

  if (action === "assign_ct_exception_owner") {
    const exceptionId = typeof body.exceptionId === "string" ? body.exceptionId : "";
    const ownerUserId =
      body.ownerUserId === null || body.ownerUserId === ""
        ? null
        : typeof body.ownerUserId === "string"
          ? body.ownerUserId
          : undefined;
    if (!exceptionId || ownerUserId === undefined) {
      return bad("exceptionId and ownerUserId (or null) required");
    }
    const ex = await prisma.ctException.findFirst({
      where: { id: exceptionId, tenantId },
    });
    if (!ex) return bad("Exception not found", 404);
    if (ownerUserId) {
      const u = await prisma.user.findFirst({
        where: { id: ownerUserId, tenantId },
        select: { id: true },
      });
      if (!u) return bad("Owner user not in tenant", 404);
    }
    await prisma.ctException.update({
      where: { id: exceptionId },
      data: { ownerUserId },
    });
    await writeCtAudit({
      tenantId,
      shipmentId: ex.shipmentId,
      entityType: "CtException",
      entityId: exceptionId,
      action: "assign_owner",
      actorUserId: actorId,
      payload: { ownerUserId },
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

  if (action === "set_shipment_customer_crm_account") {
    const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId : "";
    if (!shipmentId) return bad("shipmentId required");
    if (!(await assertShipmentTenant(shipmentId, tenantId))) return bad("Shipment not found", 404);
    const raw = body.crmAccountId;
    const crmAccountId =
      raw === null || raw === ""
        ? null
        : typeof raw === "string"
          ? raw.trim() || null
          : undefined;
    if (crmAccountId === undefined) return bad("crmAccountId required (string or null)");
    if (crmAccountId) {
      const acct = await prisma.crmAccount.findFirst({
        where: { id: crmAccountId, tenantId },
        select: { id: true },
      });
      if (!acct) return bad("CRM account not found in tenant", 404);
    }
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { customerCrmAccountId: crmAccountId },
    });
    await writeCtAudit({
      tenantId,
      shipmentId,
      entityType: "Shipment",
      entityId: shipmentId,
      action: "set_customer_crm_account",
      actorUserId: actorId,
      payload: { crmAccountId },
    });
    return NextResponse.json({ ok: true });
  }

  const TRANSPORT: TransportMode[] = ["OCEAN", "AIR", "ROAD", "RAIL"];
  const parseIso = (v: unknown): Date | null | undefined | "invalid" => {
    if (v === null) return null;
    if (v === undefined || v === "") return undefined;
    if (typeof v !== "string") return "invalid";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "invalid" : d;
  };

  if (action === "create_ct_leg") {
    const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId : "";
    if (!shipmentId) return bad("shipmentId required");
    if (!(await assertShipmentTenant(shipmentId, tenantId))) return bad("Shipment not found", 404);
    const agg = await prisma.ctShipmentLeg.aggregate({
      where: { shipmentId },
      _max: { legNo: true },
    });
    const legNo = (agg._max.legNo ?? 0) + 1;
    let mode: TransportMode | null = null;
    if (
      body.transportMode !== undefined &&
      body.transportMode !== null &&
      body.transportMode !== ""
    ) {
      if (
        typeof body.transportMode !== "string" ||
        !TRANSPORT.includes(body.transportMode as TransportMode)
      ) {
        return bad("Invalid transportMode");
      }
      mode = body.transportMode as TransportMode;
    }
    const plannedEtd = parseIso(body.plannedEtd);
    const plannedEta = parseIso(body.plannedEta);
    const actualAtd = parseIso(body.actualAtd);
    const actualAta = parseIso(body.actualAta);
    if (
      plannedEtd === "invalid" ||
      plannedEta === "invalid" ||
      actualAtd === "invalid" ||
      actualAta === "invalid"
    ) {
      return bad("Invalid date on leg");
    }
    const row = await prisma.ctShipmentLeg.create({
      data: {
        tenantId,
        shipmentId,
        legNo,
        originCode: typeof body.originCode === "string" ? body.originCode || null : null,
        destinationCode:
          typeof body.destinationCode === "string" ? body.destinationCode || null : null,
        carrier: typeof body.carrier === "string" ? body.carrier || null : null,
        transportMode: mode,
        plannedEtd: plannedEtd === undefined ? null : plannedEtd,
        plannedEta: plannedEta === undefined ? null : plannedEta,
        actualAtd: actualAtd === undefined ? null : actualAtd,
        actualAta: actualAta === undefined ? null : actualAta,
        notes: typeof body.notes === "string" ? body.notes || null : null,
      },
    });
    await writeCtAudit({
      tenantId,
      shipmentId,
      entityType: "CtShipmentLeg",
      entityId: row.id,
      action: "create",
      actorUserId: actorId,
    });
    return NextResponse.json({ ok: true, id: row.id });
  }

  if (action === "update_ct_leg") {
    const legId = typeof body.legId === "string" ? body.legId : "";
    if (!legId) return bad("legId required");
    const leg = await prisma.ctShipmentLeg.findFirst({
      where: { id: legId, tenantId, shipment: { order: { tenantId } } },
      include: { shipment: { select: { id: true } } },
    });
    if (!leg) return bad("Leg not found", 404);
    let transportModePatch: { transportMode: TransportMode | null } | Record<string, never> = {};
    if (body.transportMode !== undefined) {
      if (body.transportMode === null || body.transportMode === "") {
        transportModePatch = { transportMode: null };
      } else if (
        typeof body.transportMode === "string" &&
        TRANSPORT.includes(body.transportMode as TransportMode)
      ) {
        transportModePatch = { transportMode: body.transportMode as TransportMode };
      } else {
        return bad("Invalid transportMode");
      }
    }
    const plannedEtd = parseIso(body.plannedEtd);
    const plannedEta = parseIso(body.plannedEta);
    const actualAtd = parseIso(body.actualAtd);
    const actualAta = parseIso(body.actualAta);
    if (
      plannedEtd === "invalid" ||
      plannedEta === "invalid" ||
      actualAtd === "invalid" ||
      actualAta === "invalid"
    ) {
      return bad("Invalid date on leg");
    }
    await prisma.ctShipmentLeg.update({
      where: { id: legId },
      data: {
        ...(typeof body.originCode === "string" ? { originCode: body.originCode || null } : {}),
        ...(typeof body.destinationCode === "string"
          ? { destinationCode: body.destinationCode || null }
          : {}),
        ...(typeof body.carrier === "string" ? { carrier: body.carrier || null } : {}),
        ...transportModePatch,
        ...(plannedEtd !== undefined ? { plannedEtd } : {}),
        ...(plannedEta !== undefined ? { plannedEta } : {}),
        ...(actualAtd !== undefined ? { actualAtd } : {}),
        ...(actualAta !== undefined ? { actualAta } : {}),
        ...(typeof body.notes === "string" ? { notes: body.notes || null } : {}),
      },
    });
    await writeCtAudit({
      tenantId,
      shipmentId: leg.shipment.id,
      entityType: "CtShipmentLeg",
      entityId: legId,
      action: "update",
      actorUserId: actorId,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_ct_leg") {
    const legId = typeof body.legId === "string" ? body.legId : "";
    if (!legId) return bad("legId required");
    const leg = await prisma.ctShipmentLeg.findFirst({
      where: { id: legId, tenantId },
      select: { id: true, shipmentId: true },
    });
    if (!leg) return bad("Leg not found", 404);
    await prisma.ctShipmentLeg.delete({ where: { id: legId } });
    await writeCtAudit({
      tenantId,
      shipmentId: leg.shipmentId,
      entityType: "CtShipmentLeg",
      entityId: legId,
      action: "delete",
      actorUserId: actorId,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "move_ct_leg") {
    const legId = typeof body.legId === "string" ? body.legId : "";
    const direction = body.direction === "up" || body.direction === "down" ? body.direction : "";
    if (!legId || !direction) return bad("legId and direction (up|down) required");
    const leg = await prisma.ctShipmentLeg.findFirst({
      where: { id: legId, tenantId },
      select: { id: true, shipmentId: true, legNo: true },
    });
    if (!leg) return bad("Leg not found", 404);
    const targetLegNo = direction === "up" ? leg.legNo - 1 : leg.legNo + 1;
    if (targetLegNo < 1) return NextResponse.json({ ok: true });
    const other = await prisma.ctShipmentLeg.findFirst({
      where: { tenantId, shipmentId: leg.shipmentId, legNo: targetLegNo },
      select: { id: true, legNo: true },
    });
    if (!other) return NextResponse.json({ ok: true });

    // Swap leg numbers with a temporary slot to satisfy unique(shipmentId, legNo).
    await prisma.$transaction(async (tx) => {
      await tx.ctShipmentLeg.update({
        where: { id: leg.id },
        data: { legNo: 0 },
      });
      await tx.ctShipmentLeg.update({
        where: { id: other.id },
        data: { legNo: leg.legNo },
      });
      await tx.ctShipmentLeg.update({
        where: { id: leg.id },
        data: { legNo: other.legNo },
      });
    });

    await writeCtAudit({
      tenantId,
      shipmentId: leg.shipmentId,
      entityType: "CtShipmentLeg",
      entityId: leg.id,
      action: "reorder",
      actorUserId: actorId,
      payload: { direction, from: leg.legNo, to: targetLegNo },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "create_ct_container") {
    const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId : "";
    const containerNumber =
      typeof body.containerNumber === "string" ? body.containerNumber.trim() : "";
    if (!shipmentId || !containerNumber) return bad("shipmentId and containerNumber required");
    if (!(await assertShipmentTenant(shipmentId, tenantId))) return bad("Shipment not found", 404);
    const legId = typeof body.legId === "string" && body.legId.trim() ? body.legId.trim() : null;
    if (legId) {
      const leg = await prisma.ctShipmentLeg.findFirst({
        where: { id: legId, shipmentId, tenantId },
      });
      if (!leg) return bad("legId must belong to this shipment", 404);
    }
    const gi = parseIso(body.gateInAt);
    const go = parseIso(body.gateOutAt);
    if (gi === "invalid" || go === "invalid") return bad("Invalid gate date");
    const row = await prisma.ctShipmentContainer.create({
      data: {
        tenantId,
        shipmentId,
        legId,
        containerNumber,
        containerType:
          typeof body.containerType === "string" ? body.containerType || null : null,
        seal: typeof body.seal === "string" ? body.seal || null : null,
        status: typeof body.status === "string" ? body.status || null : null,
        notes: typeof body.notes === "string" ? body.notes || null : null,
        gateInAt: gi === undefined ? null : gi,
        gateOutAt: go === undefined ? null : go,
      },
    });
    await writeCtAudit({
      tenantId,
      shipmentId,
      entityType: "CtShipmentContainer",
      entityId: row.id,
      action: "create",
      actorUserId: actorId,
      payload: { containerNumber },
    });
    return NextResponse.json({ ok: true, id: row.id });
  }

  if (action === "update_ct_container") {
    const containerId = typeof body.containerId === "string" ? body.containerId : "";
    if (!containerId) return bad("containerId required");
    const c = await prisma.ctShipmentContainer.findFirst({
      where: { id: containerId, tenantId },
      select: { id: true, shipmentId: true },
    });
    if (!c) return bad("Container not found", 404);
    const legIdRaw = body.legId;
    let legId: string | null | undefined = undefined;
    if (legIdRaw === null || legIdRaw === "") legId = null;
    else if (typeof legIdRaw === "string" && legIdRaw.trim()) {
      legId = legIdRaw.trim();
      const leg = await prisma.ctShipmentLeg.findFirst({
        where: { id: legId, shipmentId: c.shipmentId, tenantId },
      });
      if (!leg) return bad("legId must belong to this shipment", 404);
    }
    const gateInAt = parseIso(body.gateInAt);
    const gateOutAt = parseIso(body.gateOutAt);
    if (gateInAt === "invalid" || gateOutAt === "invalid") return bad("Invalid gate date");
    await prisma.ctShipmentContainer.update({
      where: { id: containerId },
      data: {
        ...(typeof body.containerNumber === "string"
          ? { containerNumber: body.containerNumber.trim() }
          : {}),
        ...(typeof body.containerType === "string" ? { containerType: body.containerType || null } : {}),
        ...(typeof body.seal === "string" ? { seal: body.seal || null } : {}),
        ...(typeof body.status === "string" ? { status: body.status || null } : {}),
        ...(typeof body.notes === "string" ? { notes: body.notes || null } : {}),
        ...(legId !== undefined ? { legId } : {}),
        ...(gateInAt !== undefined ? { gateInAt } : {}),
        ...(gateOutAt !== undefined ? { gateOutAt } : {}),
      },
    });
    await writeCtAudit({
      tenantId,
      shipmentId: c.shipmentId,
      entityType: "CtShipmentContainer",
      entityId: containerId,
      action: "update",
      actorUserId: actorId,
    });
    return NextResponse.json({ ok: true });
  }

  return bad(`Unknown action: ${action}`, 400);
}
