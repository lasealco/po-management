import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildAutonomousOperatingLoop,
  type LoopInputs,
  type LoopPolicySignal,
  type LoopSignal,
} from "@/lib/assistant/autonomous-operating-loop";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireAutonomousLoopAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canSettings = viewerHas(access.grantSet, "org.settings", edit ? "edit" : "view");
  const canOps = viewerHas(access.grantSet, "org.controltower", "view");
  if (!canSettings && !canOps) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires settings or operations access for autonomous loop.",
        code: "FORBIDDEN",
        status: 403,
      }),
    };
  }
  return { ok: true as const, access };
}

function severityFromPriority(priority: string): LoopSignal["severity"] {
  if (priority === "HIGH") return "HIGH";
  if (priority === "LOW") return "LOW";
  return "MEDIUM";
}

function money(value: unknown): number {
  if (value == null) return 0;
  const n = Number(typeof value === "object" && "toString" in value ? String(value.toString()) : value);
  return Number.isFinite(n) ? n : 0;
}

async function loadLoopInputs(tenantId: string): Promise<LoopInputs> {
  const [actions, audits, incidents, valuePackets, policies, shadowRuns, releaseGate, playbooks, adminControl] = await Promise.all([
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 120,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true },
    }),
    prisma.assistantAuditEvent.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 160,
      select: { id: true, surface: true, feedback: true, answerKind: true, objectType: true },
    }),
    prisma.assistantObservabilityIncident.findMany({
      where: { tenantId, status: { not: "RESOLVED" } },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, status: true, severity: true, healthScore: true, failureCount: true, automationRiskCount: true },
    }),
    prisma.assistantValueRealizationPacket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, status: true, valueScore: true, roiPct: true, totalEstimatedValue: true },
    }),
    prisma.assistantAutomationPolicy.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, actionKind: true, status: true, readinessScore: true, threshold: true, rollbackPlan: true },
    }),
    prisma.assistantAutomationShadowRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { actionKind: true, matched: true, runMode: true },
    }),
    prisma.assistantReleaseGate.findFirst({
      where: { tenantId, gateKey: "assistant_quality_release" },
      orderBy: { evaluatedAt: "desc" },
      select: { status: true, score: true, threshold: true },
    }),
    prisma.assistantPlaybookRun.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, playbookId: true, status: true, priority: true, objectType: true },
    }),
    prisma.assistantAdminControl.findUnique({
      where: { tenantId_controlKey: { tenantId, controlKey: "assistant_admin_console" } },
      select: { rolloutMode: true, flagsJson: true, packetStatus: true },
    }),
  ]);

  const signals: LoopSignal[] = [
    ...actions.map((action): LoopSignal => ({
      id: action.id,
      sourceType: "ACTION" as const,
      domain: action.objectType ?? action.actionKind,
      severity: action.status === "PENDING" ? severityFromPriority(action.priority) : "LOW",
      status: action.status,
      detail: `${action.actionKind} is ${action.status}.`,
    })),
    ...audits
      .filter((audit) => audit.feedback || audit.objectType)
      .map((audit): LoopSignal => ({
        id: audit.id,
        sourceType: "AUDIT" as const,
        domain: audit.objectType ?? audit.surface,
        severity: audit.feedback === "not_helpful" ? "HIGH" : "LOW",
        status: audit.feedback ?? audit.answerKind,
        detail: `${audit.surface} produced ${audit.answerKind}.`,
      })),
    ...incidents.map((incident): LoopSignal => ({
      id: incident.id,
      sourceType: "OBSERVABILITY" as const,
      domain: "assistant_health",
      severity: incident.severity === "HIGH" ? "HIGH" : incident.severity === "CRITICAL" ? "CRITICAL" : "MEDIUM",
      status: incident.status,
      detail: `Health ${incident.healthScore}, failures ${incident.failureCount}, automation risks ${incident.automationRiskCount}.`,
    })),
    ...valuePackets.map((packet): LoopSignal => ({
      id: packet.id,
      sourceType: "VALUE" as const,
      domain: "value_realization",
      severity: packet.valueScore >= 70 ? "LOW" : packet.valueScore >= 40 ? "MEDIUM" : "HIGH",
      status: packet.status,
      detail: `Value score ${packet.valueScore}, ROI ${packet.roiPct}%, estimated value ${money(packet.totalEstimatedValue)}.`,
    })),
    ...policies.map((policy): LoopSignal => ({
      id: policy.id,
      sourceType: "POLICY" as const,
      domain: policy.actionKind,
      severity: policy.status === "ENABLED" && policy.readinessScore < policy.threshold ? "HIGH" : "LOW",
      status: policy.status,
      detail: `Policy readiness ${policy.readinessScore}/${policy.threshold}.`,
    })),
    ...(releaseGate
      ? [
          {
            id: "assistant_quality_release",
            sourceType: "RELEASE_GATE" as const,
            domain: "release_gate",
            severity: releaseGate.status === "PASSED" && releaseGate.score >= releaseGate.threshold ? ("LOW" as const) : ("CRITICAL" as const),
            status: releaseGate.status,
            detail: `Release gate ${releaseGate.score}/${releaseGate.threshold}.`,
          },
        ]
      : []),
    ...playbooks.map((run): LoopSignal => ({
      id: run.id,
      sourceType: "PLAYBOOK" as const,
      domain: run.objectType ?? run.playbookId,
      severity: run.status === "IN_PROGRESS" && run.priority === "HIGH" ? "MEDIUM" : "LOW",
      status: run.status,
      detail: `${run.playbookId} is ${run.status}.`,
    })),
  ];
  const policySignals: LoopPolicySignal[] = policies.map((policy) => ({
    id: policy.id,
    actionKind: policy.actionKind,
    status: policy.status,
    readinessScore: policy.readinessScore,
    threshold: policy.threshold,
    rollbackPlan: policy.rollbackPlan,
  }));
  const flags = adminControl?.flagsJson && typeof adminControl.flagsJson === "object" ? (adminControl.flagsJson as Record<string, unknown>) : {};
  const killSwitchActive =
    flags.killSwitch === true ||
    flags.assistantEnabled === false ||
    adminControl?.rolloutMode === "PAUSED" ||
    adminControl?.packetStatus === "BLOCKED";
  return {
    signals,
    policies: policySignals,
    shadowRuns,
    releaseGate,
    killSwitchActive,
  };
}

async function buildSnapshot(tenantId: string) {
  const [loops, inputs] = await Promise.all([
    prisma.assistantAutonomousOperatingLoop.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        loopScore: true,
        automationMode: true,
        observedSignalCount: true,
        decisionCount: true,
        proposedActionCount: true,
        approvedAutomationCount: true,
        anomalyCount: true,
        learningCount: true,
        observeJson: true,
        decideJson: true,
        actJson: true,
        learnJson: true,
        policyJson: true,
        outcomeJson: true,
        rollbackJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        approvedAt: true,
        updatedAt: true,
      },
    }),
    loadLoopInputs(tenantId),
  ]);
  const preview = buildAutonomousOperatingLoop(inputs);
  return {
    signals: {
      observed: inputs.signals.length,
      policies: inputs.policies.length,
      shadowRuns: inputs.shadowRuns.length,
      previewLoopScore: preview.loopScore,
      previewMode: preview.automationMode,
      anomalies: preview.anomalyCount,
    },
    preview,
    loops: loops.map((loop) => ({
      ...loop,
      approvedAt: loop.approvedAt?.toISOString() ?? null,
      updatedAt: loop.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requireAutonomousLoopAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireAutonomousLoopAccess(true);
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

  if (action === "queue_loop_review") {
    const loopId = typeof body.loopId === "string" ? body.loopId.trim() : "";
    const approvalNote = typeof body.approvalNote === "string" ? body.approvalNote.trim().slice(0, 4000) : "";
    if (!loopId) return toApiErrorResponse({ error: "loopId is required.", code: "BAD_INPUT", status: 400 });
    const loop = await prisma.assistantAutonomousOperatingLoop.findFirst({ where: { id: loopId, tenantId: gate.access.tenant.id } });
    if (!loop) return toApiErrorResponse({ error: "Autonomous operating loop not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_autonomous_loop",
        prompt: "Queue assistant autonomous operating loop review",
        answerKind: "assistant_autonomous_loop_review",
        message: "Assistant autonomous operating loop queued for human review. Source systems, automation policies, release gates, playbooks, action execution, and kill-switch controls were not mutated automatically.",
        evidence: { loopId: loop.id, loopScore: loop.loopScore, automationMode: loop.automationMode, approvalNote } as Prisma.InputJsonObject,
        objectType: "assistant_autonomous_operating_loop",
        objectId: loop.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_autonomous_operating_loop",
        objectId: loop.id,
        objectHref: "/assistant/autonomous-loop",
        priority: loop.automationMode === "REVIEW_ONLY" || loop.anomalyCount > 0 ? "HIGH" : "MEDIUM",
        actionId: `amp32-loop-${loop.id}`.slice(0, 128),
        actionKind: "assistant_autonomous_loop_review",
        label: `Review autonomous loop: ${loop.title}`,
        description: "Approve observe/decide/act/learn recommendations before automation, policy, or source-system changes.",
        payload: { loopId: loop.id, loopScore: loop.loopScore, automationMode: loop.automationMode, approvalNote } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantAutonomousOperatingLoop.update({
      where: { id: loop.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id, approvedByUserId: actorUserId, approvedAt: new Date(), approvalNote },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, loop: updated, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action !== "create_loop") {
    return toApiErrorResponse({ error: "Unsupported autonomous loop action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadLoopInputs(gate.access.tenant.id);
  const built = buildAutonomousOperatingLoop(inputs);
  const loop = await prisma.assistantAutonomousOperatingLoop.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      loopScore: built.loopScore,
      automationMode: built.automationMode,
      observedSignalCount: built.observedSignalCount,
      decisionCount: built.decisionCount,
      proposedActionCount: built.proposedActionCount,
      approvedAutomationCount: built.approvedAutomationCount,
      anomalyCount: built.anomalyCount,
      learningCount: built.learningCount,
      observeJson: built.observe as Prisma.InputJsonValue,
      decideJson: built.decide as Prisma.InputJsonValue,
      actJson: built.act as Prisma.InputJsonValue,
      learnJson: built.learn as Prisma.InputJsonValue,
      policyJson: built.policy as Prisma.InputJsonValue,
      outcomeJson: built.outcome as Prisma.InputJsonValue,
      rollbackJson: built.rollback as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, loopScore: true, automationMode: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_autonomous_loop",
      prompt: "Create assistant autonomous operating loop",
      answerKind: "assistant_autonomous_operating_loop",
      message: built.leadershipSummary,
      evidence: { observe: built.observe, policy: built.policy, act: built.act, rollback: built.rollback } as Prisma.InputJsonObject,
      objectType: "assistant_autonomous_operating_loop",
      objectId: loop.id,
    },
  });
  return NextResponse.json({ ok: true, loop, snapshot: await buildSnapshot(gate.access.tenant.id) }, { status: 201 });
}
