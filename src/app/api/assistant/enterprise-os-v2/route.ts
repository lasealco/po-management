import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildEnterpriseOsPacket, type EnterpriseOsInputs } from "@/lib/assistant/enterprise-os-v2";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireEnterpriseOsAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.reports", mode) ||
    viewerHas(access.grantSet, "org.settings", mode) ||
    viewerHas(access.grantSet, "org.apihub", mode) ||
    viewerHas(access.grantSet, "org.controltower", mode) ||
    viewerHas(access.grantSet, "org.orders", mode) ||
    viewerHas(access.grantSet, "org.products", mode) ||
    viewerHas(access.grantSet, "org.wms", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({ error: "Forbidden: requires reports, settings, API Hub, control tower, orders, products, or WMS access for Autonomous Enterprise OS v2.", code: "FORBIDDEN", status: 403 }),
    };
  }
  return { ok: true as const, access };
}

function num(value: Prisma.Decimal | number | bigint | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return value.toNumber();
}

async function loadEnterpriseOsInputs(tenantId: string): Promise<EnterpriseOsInputs> {
  const [
    operatingReports,
    autonomousLoops,
    valuePackets,
    executivePackets,
    agentGovernancePackets,
    aiQualityPackets,
    platformReliabilityPackets,
    tenantRolloutPackets,
    financePackets,
    productLifecyclePackets,
    advancedProgramPackets,
    auditEvents,
    actionQueue,
  ] = await Promise.all([
    prisma.assistantOperatingReport.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, status: true, score: true },
    }),
    prisma.assistantAutonomousOperatingLoop.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, loopScore: true, automationMode: true, observedSignalCount: true, proposedActionCount: true, anomalyCount: true, learningCount: true },
    }),
    prisma.assistantValueRealizationPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, valueScore: true, adoptionScore: true, totalEstimatedValue: true, roiPct: true },
    }),
    prisma.assistantExecutiveOperatingPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, executiveScore: true, strategyRiskCount: true, decisionCount: true, learningSignalCount: true },
    }),
    prisma.assistantAgentGovernancePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, governanceScore: true, highRiskAgentCount: true, observabilitySignalCount: true },
    }),
    prisma.assistantAiQualityReleasePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, qualityScore: true, failedEvalCount: true, releaseBlockerCount: true, automationRiskCount: true },
    }),
    prisma.assistantPlatformReliabilityPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, reliabilityScore: true, openIncidentCount: true, securityRiskCount: true, connectorRiskCount: true, automationRiskCount: true, changeBlockerCount: true },
    }),
    prisma.assistantTenantRolloutPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, rolloutScore: true, adoptionRiskCount: true, supportRiskCount: true, cutoverBlockerCount: true },
    }),
    prisma.assistantFinanceCashControlPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, financeScore: true, accountingBlockerCount: true, billingExceptionCount: true, closeControlGapCount: true },
    }),
    prisma.assistantProductLifecyclePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: { id: true, title: true, status: true, lifecycleScore: true, passportGapCount: true, supplierComplianceGapCount: true, sustainabilityGapCount: true },
    }),
    prisma.assistantAdvancedProgramPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 160,
      select: { id: true, ampNumber: true, programKey: true, programTitle: true, title: true, status: true, programScore: true, riskCount: true, recommendationCount: true, approvalStepCount: true },
    }),
    prisma.assistantAuditEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 700,
      select: { id: true, surface: true, answerKind: true, feedback: true, evidence: true, quality: true, createdAt: true },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 400,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
    }),
  ]);

  return {
    operatingReports,
    autonomousLoops,
    valuePackets: valuePackets.map((packet) => ({ ...packet, totalEstimatedValue: num(packet.totalEstimatedValue) })),
    executivePackets,
    agentGovernancePackets,
    aiQualityPackets,
    platformReliabilityPackets,
    tenantRolloutPackets,
    financePackets,
    productLifecyclePackets,
    advancedProgramPackets,
    auditEvents: auditEvents.map((event) => ({ id: event.id, surface: event.surface, answerKind: event.answerKind, feedback: event.feedback, evidencePresent: event.evidence != null, qualityPresent: event.quality != null, createdAt: event.createdAt.toISOString() })),
    actionQueue,
  };
}

async function buildSnapshot(tenantId: string) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantEnterpriseOsPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        enterpriseScore: true,
        autonomyMode: true,
        operatingSignalCount: true,
        domainControlCount: true,
        governanceRiskCount: true,
        valueRiskCount: true,
        rolloutRiskCount: true,
        executionActionCount: true,
        sourceSummaryJson: true,
        enterpriseTelemetryJson: true,
        autonomyReadinessJson: true,
        governanceReliabilityJson: true,
        valueExecutionJson: true,
        domainOrchestrationJson: true,
        commandCouncilJson: true,
        responsePlanJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadEnterpriseOsInputs(tenantId),
  ]);
  const preview = buildEnterpriseOsPacket(inputs);
  return {
    signals: { ...preview.sourceSummary, previewEnterpriseScore: preview.enterpriseScore },
    preview,
    packets: packets.map((packet) => ({ ...packet, approvedAt: packet.approvedAt?.toISOString() ?? null, updatedAt: packet.updatedAt.toISOString() })),
  };
}

export async function GET() {
  const gate = await requireEnterpriseOsAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireEnterpriseOsAccess(true);
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

  if (action === "queue_council_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantEnterpriseOsPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Enterprise OS packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantEnterpriseOsPacket.update({ where: { id: packet.id }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note } });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_enterprise_os_v2",
          prompt: "Approve Sprint 15 Autonomous Enterprise OS v2 packet",
          answerKind: "enterprise_os_approved",
          message: "Autonomous Enterprise OS v2 packet approved after human review. Enterprise automation, budgets, finance state, tenant rollout, product records, security operations, runtime flags, deployments, communications, and source systems were not changed automatically.",
          evidence: { packetId: packet.id, enterpriseScore: packet.enterpriseScore, autonomyMode: packet.autonomyMode, note } as Prisma.InputJsonObject,
          objectType: "assistant_enterprise_os_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_enterprise_os_v2",
        prompt: "Queue Sprint 15 enterprise council review",
        answerKind: "enterprise_os_review",
        message: "Enterprise council review queued. The assistant does not execute automations, approve budgets, change finance/product/tenant/security records, publish reports, deploy releases, or mutate production behavior.",
        evidence: { packetId: packet.id, enterpriseScore: packet.enterpriseScore, autonomyMode: packet.autonomyMode, note } as Prisma.InputJsonObject,
        objectType: "assistant_enterprise_os_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_enterprise_os_packet",
        objectId: packet.id,
        objectHref: "/assistant/enterprise-os-v2",
        priority: packet.enterpriseScore < 75 || packet.governanceRiskCount > 0 || packet.executionActionCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint15-enterprise-os-${packet.id}`.slice(0, 128),
        actionKind: "enterprise_os_council_review",
        label: `Review ${packet.title}`,
        description: "Review autonomy, governance, reliability, value, rollout, finance, product, and domain evidence before enterprise operating changes.",
        payload: { packetId: packet.id, enterpriseScore: packet.enterpriseScore, autonomyMode: packet.autonomyMode, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantEnterpriseOsPacket.update({ where: { id: packet.id }, data: { status: "COUNCIL_REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported Enterprise OS action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadEnterpriseOsInputs(gate.access.tenant.id);
  const built = buildEnterpriseOsPacket(inputs);
  const packet = await prisma.assistantEnterpriseOsPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      enterpriseScore: built.enterpriseScore,
      autonomyMode: built.autonomyMode,
      operatingSignalCount: built.operatingSignalCount,
      domainControlCount: built.domainControlCount,
      governanceRiskCount: built.governanceRiskCount,
      valueRiskCount: built.valueRiskCount,
      rolloutRiskCount: built.rolloutRiskCount,
      executionActionCount: built.executionActionCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      enterpriseTelemetryJson: built.enterpriseTelemetry as Prisma.InputJsonValue,
      autonomyReadinessJson: built.autonomyReadiness as Prisma.InputJsonValue,
      governanceReliabilityJson: built.governanceReliability as Prisma.InputJsonValue,
      valueExecutionJson: built.valueExecution as Prisma.InputJsonValue,
      domainOrchestrationJson: built.domainOrchestration as Prisma.InputJsonValue,
      commandCouncilJson: built.commandCouncil as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, enterpriseScore: true, autonomyMode: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_enterprise_os_v2",
      prompt: "Create Sprint 15 Autonomous Enterprise OS v2 packet",
      answerKind: "enterprise_os_packet",
      message: built.leadershipSummary,
      evidence: { enterpriseScore: built.enterpriseScore, autonomyMode: built.autonomyMode, sourceSummary: built.sourceSummary, responsePlan: built.responsePlan, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_enterprise_os_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id) }, { status: 201 });
}
