import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildEnterpriseRiskControlsPacket, type EnterpriseRiskControlsInputs } from "@/lib/assistant/enterprise-risk-controls";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireEnterpriseRiskControlsAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canReports = viewerHas(access.grantSet, "org.reports", edit ? "edit" : "view");
  const canSettings = viewerHas(access.grantSet, "org.settings", edit ? "edit" : "view");
  const canRiskDomain =
    viewerHas(access.grantSet, "org.suppliers", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.rfq", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.tariffs", edit ? "edit" : "view") ||
    viewerHas(access.grantSet, "org.scri", edit ? "edit" : "view");
  if (!canReports && !canSettings && !canRiskDomain) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires reporting, settings, supplier, RFQ, tariff, or SCRI access for Enterprise Risk & Controls.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function evidencePresent(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

async function loadEnterpriseRiskControlsInputs(tenantId: string, grantSet: Set<string>): Promise<EnterpriseRiskControlsInputs> {
  const [contractPackets, governancePackets, riskRooms, auditEvents, actionQueue, externalEvents] = await Promise.all([
    viewerHas(grantSet, "org.suppliers", "view") || viewerHas(grantSet, "org.rfq", "view") || viewerHas(grantSet, "org.tariffs", "view")
      ? prisma.assistantContractCompliancePacket.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: {
            id: true,
            title: true,
            status: true,
            complianceScore: true,
            obligationCount: true,
            renewalRiskCount: true,
            complianceGapCount: true,
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.settings", "view") || viewerHas(grantSet, "org.reports", "view")
      ? prisma.assistantGovernancePacket.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: {
            id: true,
            title: true,
            status: true,
            governanceScore: true,
            retentionCandidateCount: true,
            legalHoldBlockCount: true,
            privacyRiskCount: true,
          },
        })
      : Promise.resolve([]),
    viewerHas(grantSet, "org.scri", "view")
      ? prisma.assistantRiskWarRoom.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: { id: true, title: true, status: true, severity: true, riskScore: true },
        })
      : Promise.resolve([]),
    prisma.assistantAuditEvent.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, surface: true, answerKind: true, evidence: true, quality: true, feedback: true },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, actionKind: true, status: true, priority: true },
    }),
    viewerHas(grantSet, "org.scri", "view")
      ? prisma.scriExternalEvent.findMany({
          where: { tenantId, reviewState: { in: ["NEW", "UNDER_REVIEW", "WATCH", "ACTION_REQUIRED"] } },
          orderBy: [{ severity: "desc" }, { discoveredTime: "desc" }],
          take: 80,
          select: { id: true, eventType: true, title: true, severity: true, confidence: true, reviewState: true, sourceCount: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    contractPackets,
    governancePackets,
    riskRooms,
    auditEvents: auditEvents.map((event) => ({
      id: event.id,
      surface: event.surface,
      answerKind: event.answerKind,
      evidencePresent: evidencePresent(event.evidence),
      qualityPresent: event.quality != null,
      feedback: event.feedback,
    })),
    actionQueue,
    externalEvents: externalEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      title: event.title,
      severity: String(event.severity),
      confidence: event.confidence,
      reviewState: String(event.reviewState),
      sourceCount: event.sourceCount,
    })),
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantEnterpriseRiskControlPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        riskScore: true,
        obligationCount: true,
        controlGapCount: true,
        auditEvidenceCount: true,
        contractRiskCount: true,
        externalRiskCount: true,
        sourceSummaryJson: true,
        obligationGraphJson: true,
        controlTestingJson: true,
        auditEvidenceJson: true,
        contractPerformanceJson: true,
        regulatoryHorizonJson: true,
        externalRiskJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadEnterpriseRiskControlsInputs(tenantId, grantSet),
  ]);
  const preview = buildEnterpriseRiskControlsPacket(inputs);
  return {
    signals: {
      contractPackets: inputs.contractPackets.length,
      governancePackets: inputs.governancePackets.length,
      riskRooms: inputs.riskRooms.length,
      auditEvents: inputs.auditEvents.length,
      actionQueueItems: inputs.actionQueue.length,
      externalEvents: inputs.externalEvents.length,
      previewRiskScore: preview.riskScore,
      previewControlGaps: preview.controlTesting.controlGapCount,
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
  const gate = await requireEnterpriseRiskControlsAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireEnterpriseRiskControlsAccess(true);
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

  if (action === "queue_control_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantEnterpriseRiskControlPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Enterprise Risk & Controls packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantEnterpriseRiskControlPacket.update({
        where: { id: packet.id },
        data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note },
      });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_enterprise_risk_controls",
          prompt: "Approve Sprint 2 Enterprise Risk & Controls packet",
          answerKind: "enterprise_risk_controls_approved",
          message: "Enterprise Risk & Controls packet approved after human review. Obligations, controls, contracts, policies, external events, and operational source records were not changed automatically.",
          evidence: { packetId: packet.id, riskScore: packet.riskScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_enterprise_risk_control_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_enterprise_risk_controls",
        prompt: "Queue Sprint 2 Enterprise Risk & Controls review",
        answerKind: "enterprise_risk_controls_review",
        message: "Enterprise Risk & Controls review queued. The assistant does not mutate obligations, controls, contracts, policies, risk events, audit evidence, or operational source records.",
        evidence: { packetId: packet.id, riskScore: packet.riskScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_enterprise_risk_control_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_enterprise_risk_control_packet",
        objectId: packet.id,
        objectHref: "/assistant/enterprise-risk-controls",
        priority: packet.riskScore >= 75 || packet.controlGapCount > 5 ? "HIGH" : "MEDIUM",
        actionId: `sprint2-enterprise-risk-controls-${packet.id}`.slice(0, 128),
        actionKind: "enterprise_risk_controls_review",
        label: `Review ${packet.title}`,
        description: "Review obligations, control tests, audit evidence, contract performance, regulatory horizon, and external risk response before remediation.",
        payload: { packetId: packet.id, riskScore: packet.riskScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantEnterpriseRiskControlPacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id },
    });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported Enterprise Risk & Controls action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadEnterpriseRiskControlsInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildEnterpriseRiskControlsPacket(inputs);
  const packet = await prisma.assistantEnterpriseRiskControlPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      riskScore: built.riskScore,
      obligationCount: built.obligationGraph.obligationCount,
      controlGapCount: built.controlTesting.controlGapCount,
      auditEvidenceCount: built.auditEvidence.evidenceBackedCount,
      contractRiskCount: built.contractPerformance.riskPacketCount,
      externalRiskCount: built.externalRisk.activeEventCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      obligationGraphJson: built.obligationGraph as Prisma.InputJsonValue,
      controlTestingJson: built.controlTesting as Prisma.InputJsonValue,
      auditEvidenceJson: built.auditEvidence as Prisma.InputJsonValue,
      contractPerformanceJson: built.contractPerformance as Prisma.InputJsonValue,
      regulatoryHorizonJson: built.regulatoryHorizon as Prisma.InputJsonValue,
      externalRiskJson: built.externalRisk as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, riskScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_enterprise_risk_controls",
      prompt: "Create Sprint 2 Enterprise Risk & Controls packet",
      answerKind: "enterprise_risk_controls_packet",
      message: built.leadershipSummary,
      evidence: {
        riskScore: built.riskScore,
        sourceSummary: built.sourceSummary,
        responsePlan: built.responsePlan,
        rollbackPlan: built.rollbackPlan,
      } as Prisma.InputJsonObject,
      objectType: "assistant_enterprise_risk_control_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
