import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildObservabilityIncident,
  type ObservabilityActionSignal,
  type ObservabilityAuditSignal,
  type ObservabilityAutomationSignal,
  type ObservabilityShadowSignal,
} from "@/lib/assistant/observability";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireObservabilityAccess(edit = false) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return { ok: false as const, response: toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 }) };
  }
  const canSettings = viewerHas(access.grantSet, "org.settings", edit ? "edit" : "view");
  const canOps = viewerHas(access.grantSet, "org.controltower", edit ? "edit" : "view");
  if (!canSettings && !canOps) {
    return {
      ok: false as const,
      response: toApiErrorResponse({
        error: "Forbidden: requires settings or operations access for assistant observability.",
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

async function loadObservabilityInputs(tenantId: string) {
  const [audits, actions, automations, shadowRuns, releaseGate] = await Promise.all([
    prisma.assistantAuditEvent.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        surface: true,
        answerKind: true,
        message: true,
        feedback: true,
        evidence: true,
        quality: true,
        objectType: true,
        objectId: true,
        createdAt: true,
      },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, actionKind: true, status: true, priority: true, objectType: true, objectId: true, createdAt: true },
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
      select: { id: true, actionKind: true, predictedStatus: true, humanStatus: true, matched: true, runMode: true },
    }),
    prisma.assistantReleaseGate.findFirst({
      where: { tenantId, gateKey: "assistant_quality_release" },
      orderBy: { evaluatedAt: "desc" },
      select: { status: true, score: true, threshold: true },
    }),
  ]);

  const auditSignals: ObservabilityAuditSignal[] = audits.map((audit) => ({
    id: audit.id,
    surface: audit.surface,
    answerKind: audit.answerKind,
    message: audit.message,
    feedback: audit.feedback,
    evidencePresent: evidencePresent(audit.evidence),
    qualityPresent: audit.quality != null,
    objectType: audit.objectType,
    objectId: audit.objectId,
    createdAt: audit.createdAt.toISOString(),
  }));
  const actionSignals: ObservabilityActionSignal[] = actions.map((action) => ({
    id: action.id,
    actionKind: action.actionKind,
    status: action.status,
    priority: action.priority,
    objectType: action.objectType,
    objectId: action.objectId,
    createdAt: action.createdAt.toISOString(),
  }));
  const automationSignals: ObservabilityAutomationSignal[] = automations.map((automation) => ({
    id: automation.id,
    actionKind: automation.actionKind,
    status: automation.status,
    readinessScore: automation.readinessScore,
    threshold: automation.threshold,
    rollbackPlan: automation.rollbackPlan,
  }));
  const shadowSignals: ObservabilityShadowSignal[] = shadowRuns.map((run) => ({
    id: run.id,
    actionKind: run.actionKind,
    predictedStatus: run.predictedStatus,
    humanStatus: run.humanStatus,
    matched: run.matched,
    runMode: run.runMode,
  }));
  return { audits: auditSignals, actions: actionSignals, automations: automationSignals, shadowRuns: shadowSignals, releaseGate };
}

async function buildSnapshot(tenantId: string) {
  const [incidents, inputs] = await Promise.all([
    prisma.assistantObservabilityIncident.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        severity: true,
        healthScore: true,
        auditEventCount: true,
        failureCount: true,
        driftSignalCount: true,
        evidenceGapCount: true,
        automationRiskCount: true,
        healthSnapshotJson: true,
        failureSignalJson: true,
        driftSignalJson: true,
        evidenceCoverageJson: true,
        automationRiskJson: true,
        degradedModeJson: true,
        rollbackPlanJson: true,
        postmortemJson: true,
        leadershipSummary: true,
        actionQueueItemId: true,
        resolvedAt: true,
        updatedAt: true,
      },
    }),
    loadObservabilityInputs(tenantId),
  ]);
  const preview = buildObservabilityIncident(inputs);
  return {
    signals: {
      auditEvents: inputs.audits.length,
      actions: inputs.actions.length,
      automations: inputs.automations.length,
      previewHealthScore: preview.healthScore,
      previewIncidentSignals: preview.failureCount + preview.driftSignalCount + preview.automationRiskCount,
    },
    preview,
    incidents: incidents.map((incident) => ({
      ...incident,
      resolvedAt: incident.resolvedAt?.toISOString() ?? null,
      updatedAt: incident.updatedAt.toISOString(),
    })),
  };
}

export async function GET() {
  const gate = await requireObservabilityAccess(false);
  if (!gate.ok) return gate.response;
  return NextResponse.json(await buildSnapshot(gate.access.tenant.id));
}

export async function POST(request: Request) {
  const gate = await requireObservabilityAccess(true);
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

  if (action === "queue_incident_review") {
    const incidentId = typeof body.incidentId === "string" ? body.incidentId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    if (!incidentId) return toApiErrorResponse({ error: "incidentId is required.", code: "BAD_INPUT", status: 400 });
    const incident = await prisma.assistantObservabilityIncident.findFirst({ where: { id: incidentId, tenantId: gate.access.tenant.id } });
    if (!incident) return toApiErrorResponse({ error: "Observability incident not found.", code: "NOT_FOUND", status: 404 });
    const audit = await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_observability",
        prompt: "Queue assistant observability incident review",
        answerKind: "assistant_observability_review",
        message: "Assistant observability incident queued for human review. Automation policies, release gates, prompts, and source records were not changed automatically.",
        evidence: { incidentId: incident.id, healthScore: incident.healthScore, note } as Prisma.InputJsonObject,
        objectType: "assistant_observability_incident",
        objectId: incident.id,
      },
      select: { id: true },
    });
    const queue = await prisma.assistantActionQueueItem.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        auditEventId: audit.id,
        objectType: "assistant_observability_incident",
        objectId: incident.id,
        objectHref: "/assistant/observability",
        priority: incident.severity === "HIGH" ? "HIGH" : "MEDIUM",
        actionId: `amp28-observability-${incident.id}`.slice(0, 128),
        actionKind: "assistant_observability_incident_review",
        label: `Review assistant incident: ${incident.title}`,
        description: "Approve degraded-mode, rollback, and postmortem steps before changing automation or release controls.",
        payload: { incidentId: incident.id, healthScore: incident.healthScore, note } as Prisma.InputJsonObject,
      },
      select: { id: true },
    });
    const updated = await prisma.assistantObservabilityIncident.update({
      where: { id: incident.id },
      data: { status: "REVIEW_QUEUED", actionQueueItemId: queue.id },
      select: { id: true, status: true, actionQueueItemId: true },
    });
    return NextResponse.json({ ok: true, incident: updated, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action === "resolve_incident") {
    const incidentId = typeof body.incidentId === "string" ? body.incidentId.trim() : "";
    const resolutionNote = typeof body.resolutionNote === "string" ? body.resolutionNote.trim().slice(0, 4000) : "";
    if (!incidentId) return toApiErrorResponse({ error: "incidentId is required.", code: "BAD_INPUT", status: 400 });
    const updated = await prisma.assistantObservabilityIncident.updateMany({
      where: { id: incidentId, tenantId: gate.access.tenant.id },
      data: { status: "RESOLVED", resolvedByUserId: actorUserId, resolvedAt: new Date(), resolutionNote },
    });
    if (updated.count === 0) return toApiErrorResponse({ error: "Observability incident not found.", code: "NOT_FOUND", status: 404 });
    await prisma.assistantAuditEvent.create({
      data: {
        tenantId: gate.access.tenant.id,
        actorUserId,
        surface: "assistant_observability",
        prompt: "Resolve assistant observability incident",
        answerKind: "assistant_observability_resolved",
        message: "Assistant observability incident marked resolved after human review.",
        evidence: { incidentId, resolutionNote } as Prisma.InputJsonObject,
        objectType: "assistant_observability_incident",
        objectId: incidentId,
      },
    });
    return NextResponse.json({ ok: true, snapshot: await buildSnapshot(gate.access.tenant.id) });
  }

  if (action !== "create_incident") {
    return toApiErrorResponse({ error: "Unsupported observability action.", code: "BAD_INPUT", status: 400 });
  }

  const inputs = await loadObservabilityInputs(gate.access.tenant.id);
  const built = buildObservabilityIncident(inputs);
  const incident = await prisma.assistantObservabilityIncident.create({
    data: {
      tenantId: gate.access.tenant.id,
      createdByUserId: actorUserId,
      title: built.title,
      status: built.status,
      severity: built.severity,
      healthScore: built.healthScore,
      auditEventCount: built.auditEventCount,
      failureCount: built.failureCount,
      driftSignalCount: built.driftSignalCount,
      evidenceGapCount: built.evidenceGapCount,
      automationRiskCount: built.automationRiskCount,
      healthSnapshotJson: built.healthSnapshot as Prisma.InputJsonValue,
      failureSignalJson: built.failureSignals as Prisma.InputJsonValue,
      driftSignalJson: built.driftSignals as Prisma.InputJsonValue,
      evidenceCoverageJson: built.evidenceCoverage as Prisma.InputJsonValue,
      automationRiskJson: built.automationRisks as Prisma.InputJsonValue,
      degradedModeJson: built.degradedMode as Prisma.InputJsonValue,
      rollbackPlanJson: built.rollbackPlan as Prisma.InputJsonValue,
      postmortemJson: built.postmortem as Prisma.InputJsonValue,
      leadershipSummary: built.leadershipSummary,
    },
    select: { id: true, title: true, severity: true, healthScore: true, status: true },
  });
  await prisma.assistantAuditEvent.create({
    data: {
      tenantId: gate.access.tenant.id,
      actorUserId,
      surface: "assistant_observability",
      prompt: "Create assistant observability incident",
      answerKind: "assistant_observability_incident",
      message: built.leadershipSummary,
      evidence: { healthScore: built.healthScore, degradedMode: built.degradedMode, rollbackPlan: built.rollbackPlan } as Prisma.InputJsonObject,
      objectType: "assistant_observability_incident",
      objectId: incident.id,
    },
  });
  return NextResponse.json({ ok: true, incident, snapshot: await buildSnapshot(gate.access.tenant.id) }, { status: 201 });
}
