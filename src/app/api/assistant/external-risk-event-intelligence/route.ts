import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildExternalRiskEventPacket,
  type ExternalRiskEventInputs,
} from "@/lib/assistant/external-risk-event-intelligence";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireExternalRiskAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.scri", mode) ||
    viewerHas(access.grantSet, "org.reports", mode) ||
    viewerHas(access.grantSet, "org.orders", mode) ||
    viewerHas(access.grantSet, "org.controltower", mode) ||
    viewerHas(access.grantSet, "org.settings", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires SCRI, reports, orders, Control Tower, or settings access for Sprint 20.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

async function loadExternalRiskInputs(tenantId: string, grantSet: Set<string>): Promise<ExternalRiskEventInputs> {
  const canScri = viewerHas(grantSet, "org.scri", "view") || viewerHas(grantSet, "org.reports", "view");
  const canTwin = viewerHas(grantSet, "org.orders", "view") || viewerHas(grantSet, "org.settings", "view") || viewerHas(grantSet, "org.reports", "view");

  const [eventsRaw, twinSignalsRaw, twinInsightsRaw, warRoomsRaw, taskLinkCount] = await Promise.all([
    canScri
      ? prisma.scriExternalEvent.findMany({
          where: { tenantId },
          orderBy: [{ discoveredTime: "desc" }],
          take: 170,
          select: {
            id: true,
            title: true,
            severity: true,
            reviewState: true,
            confidence: true,
            ownerUserId: true,
            discoveredTime: true,
            sourceTrustScore: true,
            sourceCount: true,
            affectedEntities: { select: { matchConfidence: true }, take: 80 },
            recommendations: { where: { status: "ACTIVE" }, select: { id: true }, take: 60 },
            _count: { select: { affectedEntities: true } },
          },
        })
      : Promise.resolve([]),
    canTwin
      ? prisma.supplyChainTwinRiskSignal.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 140,
          select: { id: true, acknowledged: true },
        })
      : Promise.resolve([]),
    canTwin
      ? prisma.supplyChainTwinAssistantInsight.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 90,
          select: { id: true, status: true },
        })
      : Promise.resolve([]),
    canScri || viewerHas(grantSet, "org.settings", "view") || viewerHas(grantSet, "org.reports", "view")
      ? prisma.assistantRiskWarRoom.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 45,
          select: { id: true, status: true, riskScore: true },
        })
      : Promise.resolve([]),
    canScri
      ? prisma.scriEventTaskLink.count({ where: { tenantId } })
      : Promise.resolve(0),
  ]);

  const events = eventsRaw.map((event) => ({
    id: event.id,
    title: event.title,
    severity: String(event.severity),
    reviewState: String(event.reviewState),
    confidence: event.confidence,
    ownerUserId: event.ownerUserId,
    discoveredTime: event.discoveredTime,
    sourceTrustScore: event.sourceTrustScore,
    sourceCount: event.sourceCount,
    affectedEntityCount: event._count.affectedEntities,
    affectedEntities: event.affectedEntities.map((entity) => ({ matchConfidence: entity.matchConfidence })),
    activeRecommendationCount: event.recommendations.length,
  }));

  return {
    events,
    twinSignals: twinSignalsRaw,
    twinInsights: twinInsightsRaw.map((insight) => ({ id: insight.id, status: insight.status })),
    warRooms: warRoomsRaw.map((room) => ({ id: room.id, status: room.status, riskScore: room.riskScore })),
    taskLinkCount,
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantExternalRiskEventPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        eventIntelligenceScore: true,
        eventReviewRiskCount: true,
        exposureLinkageRiskCount: true,
        twinScenarioRiskCount: true,
        mitigationRecommendationRiskCount: true,
        coordinationEscalationRiskCount: true,
        credibilityRiskCount: true,
        sourceSummaryJson: true,
        externalEventJson: true,
        exposureMappingJson: true,
        twinScenarioJson: true,
        mitigationPortfolioJson: true,
        escalationCadenceJson: true,
        credibilityJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadExternalRiskInputs(tenantId, grantSet),
  ]);
  const preview = buildExternalRiskEventPacket(inputs);
  return {
    signals: {
      ...preview.sourceSummary,
      previewEventIntelligenceScore: preview.eventIntelligenceScore,
    },
    preview,
    packets: packets.map((packet) => ({
      ...packet,
      approvedAt: packet.approvedAt?.toISOString() ?? null,
      updatedAt: packet.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requireExternalRiskAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireExternalRiskAccess(true);
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

  if (action === "queue_external_risk_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantExternalRiskEventPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "External risk packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantExternalRiskEventPacket.update({
        where: { id: packet.id },
        data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note },
      });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_external_risk_event",
          prompt: "Approve Sprint 20 External Risk packet",
          answerKind: "sprint20_er_ok",
          message:
            "External risk packet approved after human review. SCRI events, Twin signals, mitigation recommendations, war rooms, partner notices, and mitigation executions were not mutated automatically.",
          evidence: { packetId: packet.id, eventIntelligenceScore: packet.eventIntelligenceScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_external_risk_event_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_external_risk_event",
        prompt: "Queue Sprint 20 external risk intelligence review",
        answerKind: "sprint20_er_rev",
        message:
          "External risk intelligence review queued. The assistant does not advance SCRI states, acknowledge Twin signals, publish scenarios, notify partners, accept mitigations, or execute automation automatically.",
        evidence: { packetId: packet.id, eventIntelligenceScore: packet.eventIntelligenceScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_external_risk_event_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_external_risk_event_packet",
        objectId: packet.id,
        objectHref: "/assistant/external-risk-event-intelligence",
        priority: packet.eventIntelligenceScore < 72 || packet.coordinationEscalationRiskCount > 2 ? "HIGH" : "MEDIUM",
        actionId: `sprint20-external-risk-${packet.id}`.slice(0, 128),
        actionKind: "external_risk_review",
        label: `Review ${packet.title}`,
        description:
          "Review SCRI triage posture, exposure linkage gaps, Twin/scenario cues, mitigation portfolios, escalation bridges, and ingest credibility before operational execution.",
        payload: { packetId: packet.id, eventIntelligenceScore: packet.eventIntelligenceScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantExternalRiskEventPacket.update({ where: { id: packet.id }, data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported External Risk action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadExternalRiskInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildExternalRiskEventPacket(inputs);
  const packet = await prisma.assistantExternalRiskEventPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      eventIntelligenceScore: built.eventIntelligenceScore,
      eventReviewRiskCount: built.eventReviewRiskCount,
      exposureLinkageRiskCount: built.exposureLinkageRiskCount,
      twinScenarioRiskCount: built.twinScenarioRiskCount,
      mitigationRecommendationRiskCount: built.mitigationRecommendationRiskCount,
      coordinationEscalationRiskCount: built.coordinationEscalationRiskCount,
      credibilityRiskCount: built.credibilityRiskCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      externalEventJson: built.externalEventJson as Prisma.InputJsonValue,
      exposureMappingJson: built.exposureMappingJson as Prisma.InputJsonValue,
      twinScenarioJson: built.twinScenarioJson as Prisma.InputJsonValue,
      mitigationPortfolioJson: built.mitigationPortfolioJson as Prisma.InputJsonValue,
      escalationCadenceJson: built.escalationCadenceJson as Prisma.InputJsonValue,
      credibilityJson: built.credibilityJson as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, eventIntelligenceScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_external_risk_event",
      prompt: "Create Sprint 20 External Risk packet",
      answerKind: "sprint20_er_pkt",
      message: built.leadershipSummary,
      evidence:
        {
          eventIntelligenceScore: built.eventIntelligenceScore,
          sourceSummary: built.sourceSummary,
          responsePlan: built.responsePlan,
          rollbackPlan: built.rollbackPlan,
        } as Prisma.InputJsonObject,
      objectType: "assistant_external_risk_event_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
