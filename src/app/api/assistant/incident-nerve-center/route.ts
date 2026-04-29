import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildIncidentNerveCenterPacket, type IncidentNerveCenterInputs } from "@/lib/assistant/incident-nerve-center";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireIncidentNerveCenterAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.controltower", mode) ||
    viewerHas(access.grantSet, "org.reports", mode) ||
    viewerHas(access.grantSet, "org.orders", mode) ||
    viewerHas(access.grantSet, "org.settings", mode) ||
    viewerHas(access.grantSet, "org.apihub", mode) ||
    viewerHas(access.grantSet, "org.invoice_audit", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires Control Tower, reports, orders, settings, API Hub, or invoice audit access for Sprint 17.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

async function loadIncidentInputs(tenantId: string, grantSet: Set<string>): Promise<IncidentNerveCenterInputs> {
  const canCt = viewerHas(grantSet, "org.controltower", "view") || viewerHas(grantSet, "org.reports", "view");
  const canAssistant = viewerHas(grantSet, "org.settings", "view") || viewerHas(grantSet, "org.reports", "view");
  const canTwin = viewerHas(grantSet, "org.orders", "view") || viewerHas(grantSet, "org.reports", "view");
  const canFinance = viewerHas(grantSet, "org.invoice_audit", "view") || viewerHas(grantSet, "org.reports", "view");
  const canHub = viewerHas(grantSet, "org.apihub", "view") || viewerHas(grantSet, "org.reports", "view");

  const [
    ctExceptionsRaw,
    assistantIncidents,
    observabilityIncidents,
    twinRiskSignals,
    riskWarRooms,
    invoiceIntakes,
    apiHubReviewItems,
    actionQueue,
  ] = await Promise.all([
    canCt
      ? prisma.ctException.findMany({
          where: { tenantId, status: "OPEN" },
          orderBy: { updatedAt: "desc" },
          take: 150,
          select: {
            id: true,
            type: true,
            severity: true,
            status: true,
            recoveryState: true,
            ownerUserId: true,
            shipmentId: true,
            recoveryPlan: true,
            customerDraft: true,
            shipment: {
              select: {
                shipmentNo: true,
                order: { select: { id: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    canAssistant
      ? prisma.assistantExceptionIncident.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: {
            id: true,
            title: true,
            status: true,
            severity: true,
            severityScore: true,
            incidentKey: true,
            mergedIntoIncidentId: true,
          },
        })
      : Promise.resolve([]),
    canAssistant
      ? prisma.assistantObservabilityIncident.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 60,
          select: { id: true, title: true, status: true, severity: true, healthScore: true },
        })
      : Promise.resolve([]),
    canTwin
      ? prisma.supplyChainTwinRiskSignal.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 80,
          select: { id: true, code: true, severity: true, title: true, acknowledged: true },
        })
      : Promise.resolve([]),
    canAssistant
      ? prisma.assistantRiskWarRoom.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 40,
          select: { id: true, title: true, status: true, riskScore: true },
        })
      : Promise.resolve([]),
    canFinance
      ? prisma.invoiceIntake.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: { id: true, rollupOutcome: true, redLineCount: true, amberLineCount: true },
        })
      : Promise.resolve([]),
    canHub
      ? prisma.apiHubAssistantReviewItem.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 80,
          select: { id: true, title: true, status: true, severity: true },
        })
      : Promise.resolve([]),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 280,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
    }),
  ]);

  const ctExceptions = ctExceptionsRaw.map((exception) => ({
    id: exception.id,
    type: exception.type,
    severity: String(exception.severity),
    status: String(exception.status),
    recoveryState: exception.recoveryState,
    ownerUserId: exception.ownerUserId,
    shipmentId: exception.shipmentId,
    shipmentNo: exception.shipment.shipmentNo,
    orderId: exception.shipment.order.id,
    recoveryPlan: exception.recoveryPlan,
    customerDraft: exception.customerDraft,
  }));

  return {
    ctExceptions,
    assistantIncidents,
    observabilityIncidents,
    twinRiskSignals: twinRiskSignals.map((signal) => ({
      ...signal,
      severity: String(signal.severity),
    })),
    riskWarRooms,
    invoiceIntakes: invoiceIntakes.map((invoice) => ({
      ...invoice,
      rollupOutcome: String(invoice.rollupOutcome),
    })),
    apiHubReviewItems,
    actionQueue,
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantIncidentNerveCenterPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        nerveScore: true,
        controlTowerRiskCount: true,
        crossModuleIncidentCount: true,
        blastRadiusSignalCount: true,
        recoveryGapCount: true,
        observabilityRiskCount: true,
        twinRiskCount: true,
        financeIntegrationRiskCount: true,
        sourceSummaryJson: true,
        controlTowerJson: true,
        crossModuleJson: true,
        blastRadiusJson: true,
        playbookRecoveryJson: true,
        observabilityTwinJson: true,
        financeIntegrationJson: true,
        dedupeMergeJson: true,
        customerCommsJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadIncidentInputs(tenantId, grantSet),
  ]);
  const preview = buildIncidentNerveCenterPacket(inputs);
  return {
    signals: { ...preview.sourceSummary, previewNerveScore: preview.nerveScore },
    preview,
    packets: packets.map((packet) => ({
      ...packet,
      approvedAt: packet.approvedAt?.toISOString() ?? null,
      updatedAt: packet.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requireIncidentNerveCenterAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireIncidentNerveCenterAccess(true);
  if (!gate.ok) return gate.response;
  const actorUserId = await getActorUserId();
  if (!actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "queue_incident_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantIncidentNerveCenterPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Incident Nerve Center packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantIncidentNerveCenterPacket.update({
        where: { id: packet.id },
        data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note },
      });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_incident_nerve_center",
          prompt: "Approve Sprint 17 Incident Nerve Center packet",
          answerKind: "sprint17_incident_ok",
          message:
            "Incident Nerve Center packet approved after human review. Control Tower exceptions, assistant incidents, observability/Twin signals, finance/integration reviews, merges, owner assignments, customer/carrier communications, and closures were not executed automatically.",
          evidence: { packetId: packet.id, nerveScore: packet.nerveScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_incident_nerve_center_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_incident_nerve_center",
        prompt: "Queue Sprint 17 incident command review",
        answerKind: "sprint17_incident_rev",
        message:
          "Incident command review queued. The assistant does not merge incidents, assign owners, send customer/carrier updates, acknowledge Twin signals, approve invoices, or close recovery work automatically.",
        evidence: { packetId: packet.id, nerveScore: packet.nerveScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_incident_nerve_center_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_incident_nerve_center_packet",
        objectId: packet.id,
        objectHref: "/assistant/incident-nerve-center",
        priority: packet.nerveScore < 72 || packet.recoveryGapCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint17-incident-nerve-${packet.id}`.slice(0, 128),
        actionKind: "incident_nerve_center_review",
        label: `Review ${packet.title}`,
        description: "Review cross-domain exceptions, blast radius, playbook gaps, observability/Twin, finance/integration cues, and dedupe hints before operational execution.",
        payload: { packetId: packet.id, nerveScore: packet.nerveScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantIncidentNerveCenterPacket.update({ where: { id: packet.id }, data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Incident Nerve Center action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadIncidentInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildIncidentNerveCenterPacket(inputs);
  const packet = await prisma.assistantIncidentNerveCenterPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      nerveScore: built.nerveScore,
      controlTowerRiskCount: built.controlTowerRiskCount,
      crossModuleIncidentCount: built.crossModuleIncidentCount,
      blastRadiusSignalCount: built.blastRadiusSignalCount,
      recoveryGapCount: built.recoveryGapCount,
      observabilityRiskCount: built.observabilityRiskCount,
      twinRiskCount: built.twinRiskCount,
      financeIntegrationRiskCount: built.financeIntegrationRiskCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      controlTowerJson: built.controlTower as Prisma.InputJsonValue,
      crossModuleJson: built.crossModule as Prisma.InputJsonValue,
      blastRadiusJson: built.blastRadius as Prisma.InputJsonValue,
      playbookRecoveryJson: built.playbookRecovery as Prisma.InputJsonValue,
      observabilityTwinJson: built.observabilityTwin as Prisma.InputJsonValue,
      financeIntegrationJson: built.financeIntegration as Prisma.InputJsonValue,
      dedupeMergeJson: built.dedupeMerge as Prisma.InputJsonValue,
      customerCommsJson: built.customerComms as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, nerveScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_incident_nerve_center",
      prompt: "Create Sprint 17 Incident Nerve Center packet",
      answerKind: "sprint17_incident_pkt",
      message: built.leadershipSummary,
      evidence: { nerveScore: built.nerveScore, sourceSummary: built.sourceSummary, responsePlan: built.responsePlan, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_incident_nerve_center_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
