import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildAiQualityReleasePacket, type AiQualityReleaseInputs } from "@/lib/assistant/ai-quality-release";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireAiQualityReleaseAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  const mode = edit ? "edit" : "view";
  const canOpen = viewerHas(access.grantSet, "org.settings", mode) || viewerHas(access.grantSet, "org.reports", mode) || viewerHas(access.grantSet, "org.apihub", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({ error: "Forbidden: requires settings, reports, or API Hub access for AI Quality Release Governance.", code: "FORBIDDEN", status: 403 }),
    };
  }
  return { ok: true as const, access };
}

function evidencePresent(value: Prisma.JsonValue | null | undefined) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function jsonArrayLength(value: Prisma.JsonValue | null | undefined, key: string): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const next = (value as Record<string, unknown>)[key];
  return Array.isArray(next) ? next.length : 0;
}

async function loadAiQualityReleaseInputs(tenantId: string): Promise<AiQualityReleaseInputs> {
  const [audits, reviewExamples, promptLibrary, releaseGates, automationPolicies, shadowRuns, observabilityIncidents, agentGovernancePackets, advancedProgramPackets, actionQueue] =
    await Promise.all([
      prisma.assistantAuditEvent.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 400,
        select: { id: true, surface: true, answerKind: true, message: true, evidence: true, quality: true, feedback: true, objectType: true, objectId: true, createdAt: true },
      }),
      prisma.assistantReviewExample.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        take: 160,
        select: { id: true, auditEventId: true, label: true, status: true, correctionNote: true },
      }),
      prisma.assistantPromptLibraryItem.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        take: 180,
        select: { id: true, title: true, domain: true, objectType: true, status: true, usageCount: true, updatedAt: true },
      }),
      prisma.assistantReleaseGate.findMany({
        where: { tenantId },
        orderBy: { evaluatedAt: "desc" },
        take: 80,
        select: { id: true, gateKey: true, status: true, score: true, threshold: true, notes: true, evaluatedAt: true },
      }),
      prisma.assistantAutomationPolicy.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        take: 160,
        select: { id: true, policyKey: true, actionKind: true, label: true, status: true, readinessScore: true, threshold: true, rollbackPlan: true, lastEvaluatedAt: true },
      }),
      prisma.assistantAutomationShadowRun.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 400,
        select: { id: true, actionKind: true, predictedStatus: true, humanStatus: true, matched: true, runMode: true },
      }),
      prisma.assistantObservabilityIncident.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        take: 80,
        select: { id: true, title: true, status: true, severity: true, healthScore: true, failureCount: true, driftSignalCount: true, evidenceGapCount: true, automationRiskCount: true },
      }),
      prisma.assistantAgentGovernancePacket.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        take: 80,
        select: { id: true, title: true, status: true, governanceScore: true, highRiskAgentCount: true, promptAssetCount: true, observabilitySignalCount: true },
      }),
      prisma.assistantAdvancedProgramPacket.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        take: 120,
        select: { id: true, ampNumber: true, title: true, status: true, programScore: true, riskCount: true, rollbackPlanJson: true },
      }),
      prisma.assistantActionQueueItem.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 250,
        select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
      }),
    ]);
  return {
    audits: audits.map((audit) => ({
      ...audit,
      evidence: evidencePresent(audit.evidence) ? audit.evidence : null,
      quality: evidencePresent(audit.quality) ? audit.quality : null,
      createdAt: audit.createdAt.toISOString(),
    })),
    reviewExamples,
    promptLibrary: promptLibrary.map((prompt) => ({ ...prompt, updatedAt: prompt.updatedAt.toISOString() })),
    releaseGates: releaseGates.map((gate) => ({ ...gate, evaluatedAt: gate.evaluatedAt.toISOString() })),
    automationPolicies: automationPolicies.map((policy) => ({ ...policy, lastEvaluatedAt: policy.lastEvaluatedAt?.toISOString() ?? null })),
    shadowRuns,
    observabilityIncidents,
    agentGovernancePackets: agentGovernancePackets.map((packet) => ({
      id: packet.id,
      title: packet.title,
      status: packet.status,
      governanceScore: packet.governanceScore,
      uncertifiedToolCount: packet.highRiskAgentCount,
      promptRiskCount: packet.promptAssetCount,
      observabilityRiskCount: packet.observabilitySignalCount,
    })),
    advancedProgramPackets: advancedProgramPackets.map((packet) => ({
      id: packet.id,
      ampNumber: packet.ampNumber,
      title: packet.title,
      status: packet.status,
      score: packet.programScore,
      reviewRiskCount: packet.riskCount,
      rollbackStepCount: jsonArrayLength(packet.rollbackPlanJson, "steps"),
    })),
    actionQueue,
  };
}

async function buildSnapshot(tenantId: string) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantAiQualityReleasePacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        qualityScore: true,
        auditEventCount: true,
        evalCaseCount: true,
        failedEvalCount: true,
        promptRiskCount: true,
        automationRiskCount: true,
        observabilityRiskCount: true,
        releaseBlockerCount: true,
        sourceSummaryJson: true,
        evaluationSuiteJson: true,
        groundingQualityJson: true,
        promptModelChangeJson: true,
        automationRegressionJson: true,
        observabilityWatchJson: true,
        releaseGateJson: true,
        rollbackDrillJson: true,
        responsePlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadAiQualityReleaseInputs(tenantId),
  ]);
  const preview = buildAiQualityReleasePacket(inputs);
  return {
    signals: { ...preview.sourceSummary, previewQualityScore: preview.qualityScore },
    preview,
    packets: packets.map((packet) => ({ ...packet, approvedAt: packet.approvedAt?.toISOString() ?? null, updatedAt: packet.updatedAt.toISOString() })),
  };
}

export async function GET() {
  const gate = await requireAiQualityReleaseAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireAiQualityReleaseAccess(true);
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

  if (action === "queue_release_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantAiQualityReleasePacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "AI quality release packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantAiQualityReleasePacket.update({ where: { id: packet.id }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note } });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_ai_quality_release",
          prompt: "Approve Sprint 10 AI Quality Release packet",
          answerKind: "ai_quality_release_approved",
          message: "AI Quality Release packet approved after human review. Prompts, models, tools, automations, incidents, runtime flags, releases, and production behavior were not changed automatically.",
          evidence: { packetId: packet.id, qualityScore: packet.qualityScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_ai_quality_release_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_ai_quality_release",
        prompt: "Queue Sprint 10 AI Quality release review",
        answerKind: "ai_quality_release_review",
        message: "AI quality release review queued. The assistant does not publish prompts, switch models, grant tools, enable automation, close incidents, deploy releases, or change runtime flags.",
        evidence: { packetId: packet.id, qualityScore: packet.qualityScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_ai_quality_release_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_ai_quality_release_packet",
        objectId: packet.id,
        objectHref: "/assistant/ai-quality-release",
        priority: packet.qualityScore < 75 || packet.releaseBlockerCount > 0 || packet.failedEvalCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint10-ai-quality-release-${packet.id}`.slice(0, 128),
        actionKind: "ai_quality_release_review",
        label: `Review ${packet.title}`,
        description: "Review evals, grounding, prompt/model/tool risk, automation regression, observability, release gates, and rollback before assistant release.",
        payload: { packetId: packet.id, qualityScore: packet.qualityScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantAiQualityReleasePacket.update({ where: { id: packet.id }, data: { status: "RELEASE_REVIEW_QUEUED", actionQueueItemId: queue.id } });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action !== "create_packet") return toApiErrorResponse({ error: "Unsupported AI Quality Release action.", code: "BAD_INPUT", status: 400 });
  const inputs = await loadAiQualityReleaseInputs(gate.access.tenant.id);
  const built = buildAiQualityReleasePacket(inputs);
  const packet = await prisma.assistantAiQualityReleasePacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      qualityScore: built.qualityScore,
      auditEventCount: built.groundingQuality.auditEventCount,
      evalCaseCount: built.evaluationSuite.evalCaseCount,
      failedEvalCount: built.evaluationSuite.failedEvalCount,
      promptRiskCount: built.promptModelChange.promptRiskCount,
      automationRiskCount: built.automationRegression.automationRiskCount,
      observabilityRiskCount: built.observabilityWatch.observabilityRiskCount,
      releaseBlockerCount: built.releaseGate.releaseBlockerCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      evaluationSuiteJson: built.evaluationSuite as Prisma.InputJsonValue,
      groundingQualityJson: built.groundingQuality as Prisma.InputJsonValue,
      promptModelChangeJson: built.promptModelChange as Prisma.InputJsonValue,
      automationRegressionJson: built.automationRegression as Prisma.InputJsonValue,
      observabilityWatchJson: built.observabilityWatch as Prisma.InputJsonValue,
      releaseGateJson: built.releaseGate as Prisma.InputJsonValue,
      rollbackDrillJson: built.rollbackDrill as Prisma.InputJsonValue,
      responsePlanJson: built.responsePlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, qualityScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_ai_quality_release",
      prompt: "Create Sprint 10 AI Quality Release packet",
      answerKind: "ai_quality_release_packet",
      message: built.leadershipSummary,
      evidence: { qualityScore: built.qualityScore, sourceSummary: built.sourceSummary, responsePlan: built.responsePlan, rollbackDrill: built.rollbackDrill } as Prisma.InputJsonObject,
      objectType: "assistant_ai_quality_release_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id) }, { status: 201 });
}
