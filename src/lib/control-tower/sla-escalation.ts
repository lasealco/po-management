import { prisma } from "@/lib/prisma";

import { writeCtAudit } from "./audit";
import { ctSlaAgeHours, ctSlaBreached, ctSlaThresholdHours } from "./sla-thresholds";

const DEDUPE_WINDOW_MS = 24 * 3_600_000;

async function alreadyEscalatedEntity(params: {
  tenantId: string;
  entityType: string;
  entityId: string;
}): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const row = await prisma.ctAuditLog.findFirst({
    where: {
      tenantId: params.tenantId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: "sla_escalation",
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  return Boolean(row);
}

/**
 * For internal users: if any open alert/exception is past its SLA window, add an internal note,
 * a follow-up SLA escalation alert, and an audit row (deduped per source entity per 24h).
 */
export async function ensureSlaEscalationsForShipment(params: {
  tenantId: string;
  shipmentId: string;
  actorUserId: string;
}): Promise<void> {
  const { tenantId, shipmentId, actorUserId } = params;

  const [alerts, exceptions] = await Promise.all([
    prisma.ctAlert.findMany({
      where: {
        tenantId,
        shipmentId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
        type: { not: "SLA_ESCALATION" },
      },
      select: { id: true, title: true, severity: true, createdAt: true },
    }),
    prisma.ctException.findMany({
      where: {
        tenantId,
        shipmentId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      select: { id: true, type: true, severity: true, createdAt: true },
    }),
  ]);

  for (const a of alerts) {
    if (!ctSlaBreached(a.createdAt, a.severity)) continue;
    if (await alreadyEscalatedEntity({ tenantId, entityType: "CtAlert", entityId: a.id })) {
      continue;
    }
    const age = ctSlaAgeHours(a.createdAt);
    const threshold = ctSlaThresholdHours(a.severity);
    const noteBody = `[SLA_ESCALATION] Alert "${a.title}" exceeded SLA (${age}h / threshold ${threshold}h, severity ${a.severity}).`;

    await prisma.$transaction(async (tx) => {
      await tx.ctShipmentNote.create({
        data: {
          tenantId,
          shipmentId,
          body: noteBody,
          visibility: "INTERNAL",
          createdById: actorUserId,
        },
      });
      await tx.ctAlert.create({
        data: {
          tenantId,
          shipmentId,
          type: "SLA_ESCALATION",
          severity: "CRITICAL",
          title: `SLA breach follow-up: ${a.title}`,
          body: `Original alert exceeded SLA (${age}h / ${threshold}h). Source alert id: ${a.id}.`,
          status: "OPEN",
        },
      });
    });

    await writeCtAudit({
      tenantId,
      shipmentId,
      entityType: "CtAlert",
      entityId: a.id,
      action: "sla_escalation",
      actorUserId: actorUserId,
      payload: { kind: "alert", ageHours: age, thresholdHours: threshold },
    });
  }

  for (const e of exceptions) {
    if (!ctSlaBreached(e.createdAt, e.severity)) continue;
    if (await alreadyEscalatedEntity({ tenantId, entityType: "CtException", entityId: e.id })) {
      continue;
    }
    const age = ctSlaAgeHours(e.createdAt);
    const threshold = ctSlaThresholdHours(e.severity);
    const noteBody = `[SLA_ESCALATION] Exception "${e.type}" exceeded SLA (${age}h / threshold ${threshold}h, severity ${e.severity}).`;

    await prisma.$transaction(async (tx) => {
      await tx.ctShipmentNote.create({
        data: {
          tenantId,
          shipmentId,
          body: noteBody,
          visibility: "INTERNAL",
          createdById: actorUserId,
        },
      });
      await tx.ctAlert.create({
        data: {
          tenantId,
          shipmentId,
          type: "SLA_ESCALATION",
          severity: "CRITICAL",
          title: `SLA breach follow-up: exception ${e.type}`,
          body: `Original exception exceeded SLA (${age}h / ${threshold}h). Source exception id: ${e.id}.`,
          status: "OPEN",
        },
      });
    });

    await writeCtAudit({
      tenantId,
      shipmentId,
      entityType: "CtException",
      entityId: e.id,
      action: "sla_escalation",
      actorUserId: actorUserId,
      payload: { kind: "exception", ageHours: age, thresholdHours: threshold },
    });
  }
}

/** Resolve a cron/system actor for a tenant (first active user). */
export async function resolveTenantCronActorUserId(tenantId: string): Promise<string | null> {
  const u = await prisma.user.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return u?.id ?? null;
}

/**
 * Hourly-style sweep: all tenants with demo-style multi-tenant support.
 */
export async function runSlaEscalationsAllTenants(): Promise<{
  tenants: number;
  shipmentsTouched: number;
}> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let shipmentsTouched = 0;

  for (const { id: tenantId } of tenants) {
    const actorUserId = await resolveTenantCronActorUserId(tenantId);
    if (!actorUserId) continue;

    const openAlerts = await prisma.ctAlert.findMany({
      where: {
        tenantId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
        type: { not: "SLA_ESCALATION" },
      },
      select: { shipmentId: true, createdAt: true, severity: true },
    });
    const openExc = await prisma.ctException.findMany({
      where: {
        tenantId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      select: { shipmentId: true, createdAt: true, severity: true },
    });

    const shipmentIds = new Set<string>();
    for (const r of openAlerts) {
      if (ctSlaBreached(r.createdAt, r.severity)) shipmentIds.add(r.shipmentId);
    }
    for (const r of openExc) {
      if (ctSlaBreached(r.createdAt, r.severity)) shipmentIds.add(r.shipmentId);
    }

    for (const shipmentId of shipmentIds) {
      await ensureSlaEscalationsForShipment({ tenantId, shipmentId, actorUserId });
      shipmentsTouched += 1;
    }
  }

  return { tenants: tenants.length, shipmentsTouched };
}
