import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { buildExecutiveOperatingSystemPacket, type ExecutiveOperatingSystemInputs } from "@/lib/assistant/executive-operating-system";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireExecutiveOperatingAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const mode = edit ? "edit" : "view";
  const canOpen =
    viewerHas(access.grantSet, "org.reports", mode) ||
    viewerHas(access.grantSet, "org.settings", mode) ||
    viewerHas(access.grantSet, "org.crm", mode) ||
    viewerHas(access.grantSet, "org.controltower", mode);
  if (!canOpen) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires reports, settings, CRM, or Control Tower access for the Executive Operating System.",
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

function jsonNumber(value: unknown, key: string) {
  if (!value || typeof value !== "object") return 0;
  const next = (value as Record<string, unknown>)[key];
  return typeof next === "number" ? next : 0;
}

async function loadExecutiveInputs(tenantId: string, grantSet: Set<string>): Promise<ExecutiveOperatingSystemInputs> {
  const [operatingReports, valuePackets, revenuePackets, autonomousLoops, riskPackets, trustPackets, audits, actionQueue] = await Promise.all([
    prisma.assistantOperatingReport.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { id: true, title: true, status: true, score: true, summary: true },
    }),
    prisma.assistantValueRealizationPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, status: true, valueScore: true, adoptionScore: true, totalEstimatedValue: true, roiPct: true },
    }),
    viewerHas(grantSet, "org.crm", "view") || viewerHas(grantSet, "org.reports", "view")
      ? prisma.assistantRevenueOperationsPacket.findMany({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
          take: 50,
          select: {
            id: true,
            title: true,
            status: true,
            revenueScore: true,
            feasibilityRiskCount: true,
            pricingRiskCount: true,
            commercialSnapshotJson: true,
          },
        })
      : Promise.resolve([]),
    prisma.assistantAutonomousOperatingLoop.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, status: true, loopScore: true, automationMode: true, decisionCount: true, anomalyCount: true, learningCount: true },
    }),
    prisma.assistantEnterpriseRiskControlPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, status: true, riskScore: true, controlGapCount: true, externalRiskCount: true },
    }),
    prisma.assistantPrivacySecurityTrustPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, title: true, status: true, trustScore: true, securityExceptionCount: true, threatSignalCount: true },
    }),
    prisma.assistantAuditEvent.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: { id: true, surface: true, answerKind: true, evidence: true, quality: true, feedback: true },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
    }),
  ]);

  return {
    operatingReports,
    valuePackets: valuePackets.map((packet) => ({
      ...packet,
      totalEstimatedValue: Number(packet.totalEstimatedValue),
    })),
    revenuePackets: revenuePackets.map((packet) => ({
      id: packet.id,
      title: packet.title,
      status: packet.status,
      revenueScore: packet.revenueScore,
      pipelineValue: jsonNumber(packet.commercialSnapshotJson, "totalPipelineValue"),
      feasibilityRiskCount: packet.feasibilityRiskCount,
      pricingRiskCount: packet.pricingRiskCount,
    })),
    autonomousLoops,
    riskPackets,
    trustPackets,
    audits: audits.map((audit) => ({
      id: audit.id,
      surface: audit.surface,
      answerKind: audit.answerKind,
      feedback: audit.feedback,
      evidencePresent: evidencePresent(audit.evidence),
      qualityPresent: audit.quality != null,
    })),
    actionQueue,
  };
}

async function buildSnapshot(tenantId: string, grantSet: Set<string>) {
  const [packets, inputs] = await Promise.all([
    prisma.assistantExecutiveOperatingPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        executiveScore: true,
        boardMetricCount: true,
        investorNarrativeRiskCount: true,
        corpDevSignalCount: true,
        strategyRiskCount: true,
        decisionCount: true,
        learningSignalCount: true,
        sourceSummaryJson: true,
        boardBriefJson: true,
        investorNarrativeJson: true,
        corpDevRadarJson: true,
        executiveTwinJson: true,
        strategyExecutionJson: true,
        decisionLedgerJson: true,
        learningLoopJson: true,
        operatingCadenceJson: true,
        rollbackPlanJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        approvalNote: true,
        updatedAt: true,
      },
    }),
    loadExecutiveInputs(tenantId, grantSet),
  ]);
  const preview = buildExecutiveOperatingSystemPacket(inputs);
  return {
    signals: {
      operatingReports: inputs.operatingReports.length,
      valuePackets: inputs.valuePackets.length,
      revenuePackets: inputs.revenuePackets.length,
      autonomousLoops: inputs.autonomousLoops.length,
      riskPackets: inputs.riskPackets.length,
      trustPackets: inputs.trustPackets.length,
      auditEvents: inputs.audits.length,
      actionQueueItems: inputs.actionQueue.length,
      previewExecutiveScore: preview.executiveScore,
      previewStrategyRisks: preview.strategyExecution.strategyRiskCount,
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
  const gate = await requireExecutiveOperatingAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id, gate.access.grantSet));
}

export async function POST(request: Request) {
  const gate = await requireExecutiveOperatingAccess(true);
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

  if (action === "queue_executive_review" || action === "approve_packet") {
    const packetId = typeof body.packetId === "string" ? body.packetId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!packetId) return toApiErrorResponse({ error: "packetId is required.", code: "BAD_INPUT", status: 400 });
    const packet = await prisma.assistantExecutiveOperatingPacket.findFirst({ where: { id: packetId, tenantId: gate.access.tenant.id } });
    if (!packet) return toApiErrorResponse({ error: "Executive Operating System packet not found.", code: "NOT_FOUND", status: 404 });

    if (action === "approve_packet") {
      await prisma.assistantExecutiveOperatingPacket.update({
        where: { id: packet.id },
        data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote: note },
      });
      await prisma.assistantAuditEvent.create({
        data: {
          tenantId: gate.access.tenant.id,
          actorUserId,
          surface: "assistant_executive_operating_system",
          prompt: "Approve Sprint 4 Executive Operating System packet",
          answerKind: "executive_operating_system_approved",
          message: "Executive Operating System packet approved after human review. Board materials, investor narrative, corp-dev signals, strategy, budgets, external communications, automation, and source records were not changed automatically.",
          evidence: { packetId: packet.id, executiveScore: packet.executiveScore, note } as Prisma.InputJsonObject,
          objectType: "assistant_executive_operating_packet",
          objectId: packet.id,
        },
      });
      return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
    }

    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_executive_operating_system",
        prompt: "Queue Sprint 4 Executive Operating System review",
        answerKind: "executive_operating_system_review",
        message: "Executive operating review queued. The assistant does not publish board materials, send investor/customer communications, create corp-dev commitments, change strategy, mutate budgets, execute automation, or update source records.",
        evidence: { packetId: packet.id, executiveScore: packet.executiveScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_executive_operating_packet",
        objectId: packet.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_executive_operating_packet",
        objectId: packet.id,
        objectHref: "/assistant/executive-operating-system",
        priority: packet.executiveScore < 70 || packet.strategyRiskCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `sprint4-executive-operating-${packet.id}`.slice(0, 128),
        actionKind: "executive_operating_review",
        label: `Review ${packet.title}`,
        description: "Review board brief, investor narrative, corp-dev radar, executive twin, strategy execution, decisions, and learning loop before executive use.",
        payload: { packetId: packet.id, executiveScore: packet.executiveScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    await prisma.assistantExecutiveOperatingPacket.update({
      where: { id: packet.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id },
    });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) });
  }

  if (action !== "create_packet") {
    return toApiErrorResponse({ error: "Unsupported Executive Operating System action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadExecutiveInputs(gate.access.tenant.id, gate.access.grantSet);
  const built = buildExecutiveOperatingSystemPacket(inputs);
  const packet = await prisma.assistantExecutiveOperatingPacket.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      executiveScore: built.executiveScore,
      boardMetricCount: built.boardBrief.metricCount,
      investorNarrativeRiskCount: built.investorNarrative.narrativeRiskCount,
      corpDevSignalCount: built.corpDevRadar.signalCount,
      strategyRiskCount: built.strategyExecution.strategyRiskCount,
      decisionCount: built.decisionLedger.decisionCount,
      learningSignalCount: built.learningLoop.learningSignalCount,
      sourceSummaryJson: built.sourceSummary as Prisma.InputJsonValue,
      boardBriefJson: built.boardBrief as Prisma.InputJsonValue,
      investorNarrativeJson: built.investorNarrative as Prisma.InputJsonValue,
      corpDevRadarJson: built.corpDevRadar as Prisma.InputJsonValue,
      executiveTwinJson: built.executiveTwin as Prisma.InputJsonValue,
      strategyExecutionJson: built.strategyExecution as Prisma.InputJsonValue,
      decisionLedgerJson: built.decisionLedger as Prisma.InputJsonValue,
      learningLoopJson: built.learningLoop as Prisma.InputJsonValue,
      operatingCadenceJson: built.operatingCadence as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, status: true, executiveScore: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_executive_operating_system",
      prompt: "Create Sprint 4 Executive Operating System packet",
      answerKind: "executive_operating_system_packet",
      message: built.leadershipSummary,
      evidence: {
        executiveScore: built.executiveScore,
        sourceSummary: built.sourceSummary,
        operatingCadence: built.operatingCadence,
        rollbackPlan: built.rollbackPlan,
      } as Prisma.InputJsonObject,
      objectType: "assistant_executive_operating_packet",
      objectId: packet.id,
    },
  });
  return NextResponse.json({ ok: true, packet, snapshot: await buildSnapshot(gate.access.tenant.id, gate.access.grantSet) }, { status: 201 });
}
