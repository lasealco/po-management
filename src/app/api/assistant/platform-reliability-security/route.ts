import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildPlatformReliabilityPacket, type PlatformReliabilityInputs } from "@/lib/assistant/platform-reliability-security";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requirePlatformReliabilityAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.reports", mode) ||
    viewerHas(access.grantSet, "org.settings", mode) ||
    viewerHas(access.grantSet, "org.apihub", mode) ||
    viewerHas(access.grantSet, "org.scri", mode) ||
    viewerHas(access.grantSet, "org.controltower", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({ error: "Forbidden: requires reports, settings, API Hub, SCRI, or control tower access for Platform Reliability & Security Operations.", code: "FORBIDDEN", status: 403 }),
    };
  }
  return { ok: true as const, access };
}

async function loadPlatformReliabilityInputs(tenantId: string, grantSet: Set<string>): Promise<PlatformReliabilityInputs> {
  const canReports = viewerHas(grantSet, "org.reports", "view");
  const canSettings = viewerHas(grantSet, "org.settings", "view");
  const canApiHub = canReports || viewerHas(grantSet, "org.apihub", "view");
  const [
    observabilityIncidents,
    privacySecurityPackets,
    aiQualityReleasePackets,
    adminControls,
    connectors,
    ingestionRuns,
    automationPolicies,
    shadowRuns,
    auditEvents,
    actionQueue,
  ] = await Promise.all([
    prisma.assistantObservabilityIncident.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, title: true, status: true, severity: true, healthScore: true, failureCount: true, driftSignalCount: true, evidenceGapCount: true, automationRiskCount: true },
    }),
    prisma.assistantPrivacySecurityTrustPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, trustScore: true, privacyRiskCount: true, identityRiskCount: true, securityExceptionCount: true, threatSignalCount: true },
    }),
    prisma.assistantAiQualityReleasePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, qualityScore: true, failedEvalCount: true, automationRiskCount: true, observabilityRiskCount: true, releaseBlockerCount: true },
    }),
    canSettings
      ? prisma.assistantAdminControl.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 80,
          select: { id: true, controlKey: true, rolloutMode: true, packetStatus: true, updatedAt: true },
        })
      : Promise.resolve([]),
    canApiHub
      ? prisma.apiHubConnector.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 120,
          select: { id: true, name: true, sourceKind: true, authMode: true, authState: true, status: true, lastSyncAt: true, healthSummary: true },
        })
      : Promise.resolve([]),
    canApiHub
      ? prisma.apiHubIngestionRun.findMany({
          where: { tenantId },
          orderBy: { createdAt: "desc" },
          take: 180,
          select: { id: true, connectorId: true, status: true, triggerKind: true, errorCode: true, errorMessage: true, enqueuedAt: true, finishedAt: true, connector: { select: { name: true } } },
        })
      : Promise.resolve([]),
    prisma.assistantAutomationPolicy.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 120,
      select: { id: true, policyKey: true, actionKind: true, label: true, status: true, readinessScore: true, threshold: true, rollbackPlan: true, lastEvaluatedAt: true },
    }),
    prisma.assistantAutomationShadowRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 240,
      select: { id: true, actionKind: true, predictedStatus: true, humanStatus: true, matched: true, runMode: true },
    }),
    prisma.assistantAuditEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, surface: true, answerKind: true, feedback: true, evidence: true, quality: true, createdAt: true },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
    }),
  ]);

  return {
    observabilityIncidents,
    privacySecurityPackets,
    aiQualityReleasePackets,
    adminControls: adminControls.map((control) => ({ ...control, updatedAt: control.updatedAt.toISOString() })),
    connectors: connectors.map((connector) => ({ ...connector, lastSyncAt: connector.lastSyncAt?.toISOString() ?? null })),
    ingestionRuns: ingestionRuns.map((run) => ({
      id: run.id,
      connectorId: run.connectorId,
      connectorName: run.connector?.name ?? null,
      status: run.status,
      triggerKind: run.triggerKind,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
      enqueuedAt: run.enqueuedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    })),
    automationPolicies: automationPolicies.map((policy) => ({ ...policy, lastEvaluatedAt: policy.lastEvaluatedAt?.toISOString() ?? null })),
    shadowRuns,
    auditEvents: auditEvents.map((event) => ({ id: event.id, surface: event.surface, answerKind: event.answerKind, feedback: event.feedback, evidencePresent: event.evidence != null, qualityPresent: event.quality != null, createdAt: event.createdAt.toISOString() })),
    actionQueue,
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantPlatformReliabilityPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        reliabilityScore: true,
        openIncidentCount: true,
        securityRiskCount: true,
        connectorRiskCount: true,
        automationRiskCount: true,
        changeBlockerCount: true,
        operationalActionCount: true,
        sourceSummaryJson: true,
        reliabilityPostureJson: true,
        securityOperationsJson: true,
        connectorHealthJson: true,
        automationSafetyJson: true,
        incidentReadinessJson: true,
        releaseChangeControlJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadPlatformReliabilityInputs(tenantId, grantSet),
  ]);
  const preview = buildPlatformReliabilityPacket(inputs);
  return {
    signals: { ...preview.sourceSummary, previewReliabilityScore: preview.reliabilityScore },
    preview,
    packets: packets.map((packet) => ({ ...packet, approvedAt: packet.approvedAt?.toISOString() ?? null, updatedAt: packet.updatedAt.toISOString() })),
  };
}

export async function GET() {
  const gate = await requirePlatformReliabilityAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requirePlatformReliabilityAccess(true);
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

  if (action === "queue_ops_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantPlatformReliabilityPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Platform reliability packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantPlatformReliabilityPacket.update({ where: { id: packet.id }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note } });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_platform_reliability_security",
          prompt: "Approve Sprint 14 Platform Reliability packet",
          answerKind: "platform_reliability_approved",
          message: "Platform Reliability & Security Operations packet approved after human review. Incidents, access, secrets, connectors, ingestion, automation policies, runtime flags, deployments, traffic, and security/customer communications were not changed automatically.",
          evidence: { packetId: packet.id, reliabilityScore: packet.reliabilityScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_platform_reliability_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_platform_reliability_security",
        prompt: "Queue Sprint 14 platform operations review",
        answerKind: "platform_ops_review",
        message: "Platform operations review queued. The assistant does not page teams, close incidents, rotate secrets, change access, retry connectors, pause automation, deploy releases, or mutate production behavior.",
        evidence: { packetId: packet.id, reliabilityScore: packet.reliabilityScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_platform_reliability_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_platform_reliability_packet",
        objectId: packet.id,
        objectHref: "/assistant/platform-reliability-security",
        priority: packet.reliabilityScore < 75 || packet.openIncidentCount > 0 || packet.securityRiskCount > 0 || packet.connectorRiskCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint14-platform-reliability-${packet.id}`.slice(0, 128),
        actionKind: "platform_reliability_security_review",
        label: `Review ${packet.title}`,
        description: "Review platform reliability, security operations, connector health, automation safety, incident readiness, release/change controls, and rollback evidence before operational action.",
        payload: { packetId: packet.id, reliabilityScore: packet.reliabilityScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantPlatformReliabilityPacket.update({ where: { id: packet.id }, data: { status: "OPS_REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Platform Reliability action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadPlatformReliabilityInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildPlatformReliabilityPacket(inputs);
  const packet = await prisma.assistantPlatformReliabilityPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      reliabilityScore: built.reliabilityScore,
      openIncidentCount: built.openIncidentCount,
      securityRiskCount: built.securityRiskCount,
      connectorRiskCount: built.connectorRiskCount,
      automationRiskCount: built.automationRiskCount,
      changeBlockerCount: built.changeBlockerCount,
      operationalActionCount: built.operationalActionCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      reliabilityPostureJson: built.reliabilityPosture as Prisma.InputJsonValue,
      securityOperationsJson: built.securityOperations as Prisma.InputJsonValue,
      connectorHealthJson: built.connectorHealth as Prisma.InputJsonValue,
      automationSafetyJson: built.automationSafety as Prisma.InputJsonValue,
      incidentReadinessJson: built.incidentReadiness as Prisma.InputJsonValue,
      releaseChangeControlJson: built.releaseChangeControl as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, reliabilityScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_platform_reliability_security",
      prompt: "Create Sprint 14 Platform Reliability packet",
      answerKind: "platform_reliability_packet",
      message: built.leadershipSummary,
      evidence: { reliabilityScore: built.reliabilityScore, sourceSummary: built.sourceSummary, responsePlan: built.responsePlan, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_platform_reliability_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
