import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  computeAutomationReadiness,
  defaultRollbackPlan,
  parseAssistantAutomationPolicyStatus,
} from "@/lib/assistant/governed-automation";
import { getActorUserId, getViewerGrantSet } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

function evidencePresent(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

async function buildCandidateRows(tenantId: string) {
  const [actions, audits, releaseGate, policies, shadowRuns] = await Promise.all([
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        actionKind: true,
        actionId: true,
        label: true,
        status: true,
        payload: true,
        auditEventId: true,
        createdAt: true,
      },
    }),
    prisma.assistantAuditEvent.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { evidence: true, quality: true },
    }),
    prisma.assistantReleaseGate.findFirst({
      where: { tenantId, gateKey: "assistant_quality_release" },
      orderBy: { evaluatedAt: "desc" },
      select: { status: true, score: true, evaluatedAt: true },
    }),
    prisma.assistantAutomationPolicy.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        policyKey: true,
        actionKind: true,
        label: true,
        status: true,
        readinessScore: true,
        threshold: true,
        guardrailsJson: true,
        rollbackPlan: true,
        enabledAt: true,
        pausedAt: true,
        lastEvaluatedAt: true,
      },
    }),
    prisma.assistantAutomationShadowRun.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        policyId: true,
        actionQueueItemId: true,
        actionKind: true,
        predictedStatus: true,
        humanStatus: true,
        matched: true,
        runMode: true,
        notes: true,
        createdAt: true,
      },
    }),
  ]);
  const policyByKind = new Map(policies.map((policy) => [policy.actionKind, policy]));
  const shadowByKind = new Map<string, { total: number; matched: number }>();
  for (const run of shadowRuns) {
    const row = shadowByKind.get(run.actionKind) ?? { total: 0, matched: 0 };
    row.total += 1;
    if (run.matched) row.matched += 1;
    shadowByKind.set(run.actionKind, row);
  }
  const evidenceCoveragePct = Math.round(
    (audits.filter((audit) => evidencePresent(audit.evidence) || audit.quality != null).length / Math.max(1, audits.length)) * 100,
  );
  const releaseGatePassed = releaseGate?.status === "PASSED";
  const actionKinds = [...new Set(actions.map((action) => action.actionKind))].slice(0, 12);
  const candidates = actionKinds.map((actionKind) => {
    const kindActions = actions.filter((action) => action.actionKind === actionKind);
    const shadow = shadowByKind.get(actionKind) ?? { total: 0, matched: 0 };
    const readiness = computeAutomationReadiness({
      recentCount: kindActions.length,
      completedCount: kindActions.filter((action) => action.status === "DONE").length,
      rejectedCount: kindActions.filter((action) => action.status === "REJECTED").length,
      shadowRunCount: shadow.total,
      shadowMatchCount: shadow.matched,
      evidenceCoveragePct,
      releaseGatePassed,
    });
    const policy = policyByKind.get(actionKind) ?? null;
    return {
      actionKind,
      policy,
      sampleAction: kindActions[0] ?? null,
      recentCount: kindActions.length,
      readiness,
      recommendedStatus: readiness.canEnable ? "ENABLED" : "SHADOW",
    };
  });
  return {
    releaseGate,
    evidenceCoveragePct,
    candidates,
    policies: policies.map((policy) => ({
      ...policy,
      enabledAt: policy.enabledAt?.toISOString() ?? null,
      pausedAt: policy.pausedAt?.toISOString() ?? null,
      lastEvaluatedAt: policy.lastEvaluatedAt?.toISOString() ?? null,
    })),
    shadowRuns: shadowRuns.slice(0, 60).map((run) => ({ ...run, createdAt: run.createdAt.toISOString() })),
  };
}

export async function GET() {
  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const payload = await buildCandidateRows(tenant.id);
  return NextResponse.json({ generatedAt: new Date().toISOString(), ...payload });
}

export async function POST(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  const tenant = await getDemoTenant();
  const actorUserId = await getActorUserId();
  if (!tenant || !actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const action = typeof o.action === "string" ? o.action : "";
  const actionKind = typeof o.actionKind === "string" && o.actionKind.trim() ? o.actionKind.trim().slice(0, 64) : "";
  if (!actionKind) return toApiErrorResponse({ error: "actionKind is required.", code: "BAD_INPUT", status: 400 });

  if (action === "record_shadow_run") {
    const actionQueueItemId = typeof o.actionQueueItemId === "string" && o.actionQueueItemId.trim() ? o.actionQueueItemId.trim() : null;
    const humanStatus = typeof o.humanStatus === "string" && o.humanStatus.trim() ? o.humanStatus.trim().toUpperCase().slice(0, 32) : null;
    const predictedStatus = typeof o.predictedStatus === "string" && o.predictedStatus.trim() ? o.predictedStatus.trim().toUpperCase().slice(0, 32) : "DONE";
    const policy = await prisma.assistantAutomationPolicy.findFirst({ where: { tenantId: tenant.id, actionKind }, select: { id: true } });
    const row = await prisma.assistantAutomationShadowRun.create({
      data: {
        tenantId: tenant.id,
        policyId: policy?.id ?? null,
        actionQueueItemId,
        actionKind,
        predictedStatus,
        humanStatus,
        matched: humanStatus ? humanStatus === predictedStatus : null,
        runMode: "SHADOW",
        notes: typeof o.notes === "string" && o.notes.trim() ? o.notes.trim().slice(0, 4000) : null,
        wouldExecutePayload: o.wouldExecutePayload && typeof o.wouldExecutePayload === "object" ? (o.wouldExecutePayload as Prisma.InputJsonObject) : undefined,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, shadowRun: row });
  }

  const candidateRows = await buildCandidateRows(tenant.id);
  const candidate = candidateRows.candidates.find((row) => row.actionKind === actionKind);
  if (!candidate) return toApiErrorResponse({ error: "No automation candidate for actionKind.", code: "BAD_INPUT", status: 400 });
  const policyKey = `assistant-action-${actionKind}`;

  if (action === "save_policy" || action === "set_status") {
    const nextStatus =
      action === "save_policy" ? "SHADOW" : parseAssistantAutomationPolicyStatus(o.status) ?? null;
    if (!nextStatus) return toApiErrorResponse({ error: "Valid status is required.", code: "BAD_INPUT", status: 400 });
    if (nextStatus === "ENABLED" && !candidate.readiness.canEnable) {
      return toApiErrorResponse({
        error: "Automation cannot be enabled until all guardrails pass.",
        code: "CONFLICT",
        status: 409,
      });
    }
    const now = new Date();
    const policy = await prisma.assistantAutomationPolicy.upsert({
      where: { tenantId_policyKey: { tenantId: tenant.id, policyKey } },
      update: {
        label: typeof o.label === "string" && o.label.trim() ? o.label.trim().slice(0, 180) : `Assist ${actionKind}`,
        status: nextStatus,
        readinessScore: candidate.readiness.score,
        guardrailsJson: candidate.readiness.guardrails as unknown as Prisma.InputJsonValue,
        rollbackPlan:
          typeof o.rollbackPlan === "string" && o.rollbackPlan.trim()
            ? o.rollbackPlan.trim().slice(0, 4000)
            : defaultRollbackPlan(actionKind),
        lastEvaluatedAt: now,
        enabledByUserId: nextStatus === "ENABLED" ? actorUserId : undefined,
        enabledAt: nextStatus === "ENABLED" ? now : undefined,
        pausedAt: nextStatus === "PAUSED" ? now : nextStatus === "ENABLED" ? null : undefined,
      },
      create: {
        tenantId: tenant.id,
        policyKey,
        actionKind,
        label: typeof o.label === "string" && o.label.trim() ? o.label.trim().slice(0, 180) : `Assist ${actionKind}`,
        status: nextStatus,
        readinessScore: candidate.readiness.score,
        guardrailsJson: candidate.readiness.guardrails as unknown as Prisma.InputJsonValue,
        rollbackPlan:
          typeof o.rollbackPlan === "string" && o.rollbackPlan.trim()
            ? o.rollbackPlan.trim().slice(0, 4000)
            : defaultRollbackPlan(actionKind),
        lastEvaluatedAt: now,
        enabledByUserId: nextStatus === "ENABLED" ? actorUserId : null,
        enabledAt: nextStatus === "ENABLED" ? now : null,
        pausedAt: nextStatus === "PAUSED" ? now : null,
      },
      select: { id: true, status: true, readinessScore: true },
    });
    await prisma.assistantAuditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId,
        surface: "assistant_governed_automation",
        prompt: `Set automation policy ${actionKind} to ${nextStatus}`,
        answerKind: "automation_policy",
        message: `Automation policy ${actionKind} is ${nextStatus}; no silent execution is allowed outside policy state.`,
        evidence: [{ label: "Governed automation", href: "/assistant/governed-automation" }],
        quality: { mode: "human_governed", readinessScore: candidate.readiness.score },
        objectType: "assistant_automation_policy",
        objectId: policy.id,
      },
    });
    return NextResponse.json({ ok: true, policy });
  }

  return toApiErrorResponse({ error: "Unsupported governed automation action.", code: "BAD_INPUT", status: 400 });
}
