import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildRiskWarRoomDraft, type RiskWarRoomEventSignal, type RiskWarRoomSeverity } from "@/lib/assistant/risk-war-room";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { buildTwinScenarioDraftFromScriEvent } from "@/lib/scri/twin-bridge/build-twin-scenario-draft-from-scri-event";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { upsertRiskSignalByCodeForTenant } from "@/lib/supply-chain-twin/risk-signals-repo";

export const dynamic = "force-dynamic";

async function requireRiskWarRoomAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const twinGate = await requireTwinApiAccess();
  if (!twinGate.ok) {
    return { ok: false as const, response: toApiErrorResponse({ error: twinGate.denied.error, code: "FORBIDDEN", status: 403 }) };
  }
  const canScri = viewerHas(access.grantSet, "org.scri", edit ? "edit" : "view");
  const canOps =
    viewerHas(access.grantSet, "org.controltower", "view") ||
    viewerHas(access.grantSet, "org.srm", "view") ||
    viewerHas(access.grantSet, "org.po", "view") ||
    viewerHas(access.grantSet, "org.crm", "view");
  if (!canScri || !canOps) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires SCRI, Twin visibility, and operational exposure evidence access.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function severity(value: string): RiskWarRoomSeverity {
  return value === "CRITICAL" || value === "HIGH" || value === "LOW" ? value : "MEDIUM";
}

async function loadEventSignals(tenantId: string, eventIds?: string[]): Promise<RiskWarRoomEventSignal[]> {
  const events = await prisma.scriExternalEvent.findMany({
    where: {
      tenantId,
      ...(eventIds?.length ? { id: { in: eventIds } } : { reviewState: { in: ["NEW", "UNDER_REVIEW", "WATCH", "ACTION_REQUIRED"] } }),
    },
    orderBy: [{ severity: "desc" }, { discoveredTime: "desc" }],
    take: eventIds?.length ? 50 : 30,
    select: {
      id: true,
      ingestKey: true,
      clusterKey: true,
      eventType: true,
      title: true,
      shortSummary: true,
      severity: true,
      confidence: true,
      reviewState: true,
      discoveredTime: true,
      sourceCount: true,
      geographies: { select: { label: true, countryCode: true, region: true, portUnloc: true } },
      affectedEntities: {
        orderBy: { matchConfidence: "desc" },
        take: 80,
        select: { objectType: true, objectId: true, matchType: true, matchConfidence: true, impactLevel: true, rationale: true },
      },
      recommendations: {
        where: { status: "ACTIVE" },
        orderBy: [{ priority: "desc" }, { confidence: "desc" }],
        take: 20,
        select: {
          id: true,
          recommendationType: true,
          targetObjectType: true,
          targetObjectId: true,
          priority: true,
          confidence: true,
          expectedEffect: true,
          status: true,
        },
      },
    },
  });
  return events.map((event) => ({
    id: event.id,
    ingestKey: event.ingestKey,
    clusterKey: event.clusterKey,
    eventType: event.eventType,
    title: event.title,
    shortSummary: event.shortSummary,
    severity: severity(event.severity),
    confidence: event.confidence,
    reviewState: event.reviewState,
    discoveredTime: event.discoveredTime.toISOString(),
    sourceCount: event.sourceCount,
    geographyLabels: event.geographies
      .map((geo) => geo.label ?? geo.portUnloc ?? geo.region ?? geo.countryCode)
      .filter((label): label is string => Boolean(label)),
    affectedEntities: event.affectedEntities,
    recommendations: event.recommendations,
  }));
}

async function buildSnapshot(tenantId: string) {
  const [rooms, eventSignals] = await Promise.all([
    prisma.assistantRiskWarRoom.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        severity: true,
        riskScore: true,
        primaryScriEventId: true,
        scenarioDraftId: true,
        riskSignalId: true,
        eventClusterJson: true,
        exposureMapJson: true,
        mitigationPlanJson: true,
        communicationDraftJson: true,
        actionQueueItemId: true,
        acknowledgedAt: true,
        updatedAt: true,
      },
    }),
    loadEventSignals(tenantId),
  ]);
  const preview = buildRiskWarRoomDraft({ events: eventSignals });
  return {
    signals: {
      openEvents: eventSignals.length,
      affectedObjects: preview.exposureMap.totalObjects,
      highExposureObjects: preview.exposureMap.highExposureCount,
      activeRecommendations: eventSignals.flatMap((event) => event.recommendations).length,
    },
    preview,
    rooms: rooms.map((room) => ({
      ...room,
      acknowledgedAt: room.acknowledgedAt?.toISOString() ?? null,
      updatedAt: room.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requireRiskWarRoomAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireRiskWarRoomAccess(true);
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

  if (action === "acknowledge") {
    const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
    if (!roomId) return toApiErrorResponse({ error: "roomId is required.", code: "BAD_INPUT", status: 400 });
    const existing = await prisma.assistantRiskWarRoom.findFirst({ where: { id: roomId, tenantId: gate.access.tenant.id }, select: { id: true } });
    if (!existing) return toApiErrorResponse({ error: "Risk war room not found.", code: "NOT_FOUND", status: 404 });
    const room = await prisma.assistantRiskWarRoom.update({
      where: { id: existing.id },
      data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date(), approvedByUserId: actorUserId },
      select: { id: true, status: true },
    });
    await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_risk_war_room",
        prompt: "Acknowledge risk war room",
        answerKind: "risk_war_room_acknowledgement",
        message: "Risk war room acknowledged; no SCRI event, Twin scenario, or operational source record was mutated.",
        objectType: "assistant_risk_war_room",
        objectId: room.id,
      },
    });
    return NextResponse.json({ ok: true, room, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action === "queue_mitigation") {
    const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!roomId) return toApiErrorResponse({ error: "roomId is required.", code: "BAD_INPUT", status: 400 });
    const room = await prisma.assistantRiskWarRoom.findFirst({ where: { id: roomId, tenantId: gate.access.tenant.id } });
    if (!room) return toApiErrorResponse({ error: "Risk war room not found.", code: "NOT_FOUND", status: 404 });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        objectType: "assistant_risk_war_room",
        objectId: room.id,
        objectHref: "/assistant/risk-war-room",
        actionId: `amp20-risk-${room.id}`.slice(0, 128),
        actionKind: "risk_mitigation_review",
        label: `Review risk mitigations: ${room.title}`,
        description:
          "Approve or edit risk mitigations, Twin scenario assumptions, and external communication drafts. The assistant does not mutate SCRI events, Twin runs, suppliers, shipments, orders, or customer messages automatically.",
        priority: room.riskScore >= 85 ? "HIGH" : "MEDIUM",
        payload: {
          riskScore: room.riskScore,
          severity: room.severity,
          primaryScriEventId: room.primaryScriEventId,
          scenarioDraftId: room.scenarioDraftId,
          approvalNote,
        } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantRiskWarRoom.update({
      where: { id: room.id },
      data: { status: "MITIGATION_QUEUED", actionQueueItemId: queue.id, approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_risk_war_room",
        prompt: "Queue risk mitigation review",
        answerKind: "risk_war_room_mitigation",
        message: "Risk mitigations queued for human approval with no automatic source-record mutation.",
        evidence: { roomId: room.id, queueItemId: queue.id, approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_risk_war_room",
        objectId: room.id,
      },
    });
    return NextResponse.json({ ok: true, room: updated, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action === "create_war_room") {
    const eventIds = Array.isArray(body.eventIds) ? body.eventIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).map((id) => id.trim()) : undefined;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 240) : "";
    const events = await loadEventSignals(gate.access.tenant.id, eventIds);
    if (events.length === 0) return toApiErrorResponse({ error: "No SCRI events available for a risk war room.", code: "BAD_INPUT", status: 400 });
    const draft = buildRiskWarRoomDraft({ events, prompt });

    const primaryEvent = draft.primaryScriEventId
      ? await prisma.scriExternalEvent.findFirst({
          where: { id: draft.primaryScriEventId, tenantId: gate.access.tenant.id },
          include: { geographies: true, affectedEntities: true },
        })
      : null;
    const builtScenario = primaryEvent ? buildTwinScenarioDraftFromScriEvent(primaryEvent, primaryEvent.geographies, primaryEvent.affectedEntities) : null;

    const created = await prisma.$transaction(async (tx) => {
      let scenarioDraftId: string | null = null;
      let riskSignalId: string | null = null;
      if (primaryEvent && builtScenario) {
        const riskSignal = await upsertRiskSignalByCodeForTenant(
          gate.access.tenant.id,
          {
            code: builtScenario.draft.twin.riskSignalCode,
            severity: primaryEvent.severity,
            title: builtScenario.riskSignalTitle,
            detail: builtScenario.riskSignalDetail,
          },
          tx,
        );
        riskSignalId = riskSignal.id;
        const scenario = await tx.supplyChainTwinScenarioDraft.create({
          data: {
            tenantId: gate.access.tenant.id,
            title: draft.scenarioProposal.title,
            status: "draft",
            draftJson: {
              ...(builtScenario.draft as unknown as Record<string, unknown>),
              warRoom: draft.scenarioProposal,
            } as Prisma.InputJsonValue,
          },
          select: { id: true, title: true, status: true },
        });
        scenarioDraftId = scenario.id;
        await tx.supplyChainTwinScenarioRevision.create({
          data: {
            tenantId: gate.access.tenant.id,
            scenarioDraftId: scenario.id,
            actorId: actorUserId,
            action: "create",
            titleBefore: null,
            titleAfter: scenario.title,
            statusBefore: null,
            statusAfter: scenario.status,
          },
        });
      }

      const room = await tx.assistantRiskWarRoom.create({
        data: {
          tenantId: gate.access.tenant.id,
          createdByUserId: actorUserId,
          title: draft.title,
          status: "DRAFT",
          severity: draft.severity,
          riskScore: draft.riskScore,
          primaryScriEventId: draft.primaryScriEventId,
          scenarioDraftId,
          riskSignalId,
          eventClusterJson: draft.eventCluster as Prisma.InputJsonValue,
          exposureMapJson: draft.exposureMap as Prisma.InputJsonValue,
          scenarioProposalJson: { ...draft.scenarioProposal, scenarioDraftId, riskSignalId } as Prisma.InputJsonValue,
          mitigationPlanJson: draft.mitigationPlan as Prisma.InputJsonValue,
          communicationDraftJson: draft.communicationDraft as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      await tx.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_risk_war_room",
          prompt: "Create risk intelligence war room",
          answerKind: "risk_war_room",
          message:
            "Risk war room created with SCRI cluster evidence, Twin scenario draft, mitigation plan, and communication drafts. Operational source records were not mutated.",
          evidence: { riskScore: draft.riskScore, severity: draft.severity, primaryScriEventId: draft.primaryScriEventId } as Prisma.InputJsonObject,
          objectType: "assistant_risk_war_room",
          objectId: room.id,
        },
      });
      return room;
    });

    return NextResponse.json({ ok: true, room: created, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  return toApiErrorResponse({ error: "Unsupported action.", code: "BAD_INPUT", status: 400 });
}
