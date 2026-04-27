import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { isAssistantEmailPilotEnabled } from "@/lib/assistant/email-pilot";
import { buildAssistantInbox } from "@/lib/assistant/inbox-aggregate";
import { getActorUserId, getViewerGrantSet, requireApiGrant, viewerHas } from "@/lib/authz";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function payloadHref(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const href = (payload as Record<string, unknown>).href;
  return typeof href === "string" && href.startsWith("/") ? href : null;
}

function percent(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function addCount(map: Map<string, number>, key: string | null | undefined, fallback: string) {
  const normalized = key?.trim() || fallback;
  map.set(normalized, (map.get(normalized) ?? 0) + 1);
}

function ageDays(value: Date) {
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60 * 24)));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function GET() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  }

  const canCt = viewerHas(access.grantSet, "org.controltower", "view");
  const canOrders = viewerHas(access.grantSet, "org.orders", "view");
  if (!canCt && !canOrders) {
    return toApiErrorResponse({ error: "Not allowed.", code: "FORBIDDEN", status: 403 });
  }
  if (canCt) {
    const gate = await requireApiGrant("org.controltower", "view");
    if (gate) return gate;
  }
  if (canOrders) {
    const gate = await requireApiGrant("org.orders", "view");
    if (gate) return gate;
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const actorUserId = await getActorUserId();
  if (!actorUserId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const ctCtx = await getControlTowerPortalContext(actorUserId);
  const inbox = await buildAssistantInbox({
    tenantId: tenant.id,
    actorUserId,
    ctCtx,
    include: {
      ctAlerts: canCt,
      ctExceptions: canCt,
      soDrafts: canOrders,
      emailThreads: canOrders && isAssistantEmailPilotEnabled(),
    },
  });

  const staleBefore = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  const [
    auditTotal,
    helpfulCount,
    needsReviewCount,
    recentAuditEvents,
    pendingActionCount,
    doneActionCount,
    pendingActions,
    activePlaybookCount,
    completedPlaybookCount,
    stalePlaybookCount,
    playbookRuns,
    stalePlaybookRuns,
    recentActions,
  ] = await Promise.all([
    prisma.assistantAuditEvent.count({ where: { tenantId: tenant.id } }),
    prisma.assistantAuditEvent.count({ where: { tenantId: tenant.id, feedback: "helpful" } }),
    prisma.assistantAuditEvent.count({ where: { tenantId: tenant.id, feedback: "not_helpful" } }),
    prisma.assistantAuditEvent.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        prompt: true,
        answerKind: true,
        message: true,
        evidence: true,
        quality: true,
        feedback: true,
        objectType: true,
        objectId: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    }),
    prisma.assistantActionQueueItem.count({ where: { tenantId: tenant.id, status: "PENDING" } }),
    prisma.assistantActionQueueItem.count({ where: { tenantId: tenant.id, status: "DONE" } }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId: tenant.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        actionKind: true,
        label: true,
        description: true,
        status: true,
        payload: true,
        objectType: true,
        objectId: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    }),
    prisma.assistantPlaybookRun.count({ where: { tenantId: tenant.id, status: "IN_PROGRESS" } }),
    prisma.assistantPlaybookRun.count({ where: { tenantId: tenant.id, status: "COMPLETED" } }),
    prisma.assistantPlaybookRun.count({
      where: { tenantId: tenant.id, status: "IN_PROGRESS", updatedAt: { lt: staleBefore } },
    }),
    prisma.assistantPlaybookRun.findMany({
      where: { tenantId: tenant.id },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        playbookId: true,
        title: true,
        status: true,
        objectType: true,
        objectId: true,
        updatedAt: true,
        actor: { select: { name: true } },
      },
    }),
    prisma.assistantPlaybookRun.findMany({
      where: { tenantId: tenant.id, status: "IN_PROGRESS", updatedAt: { lt: staleBefore } },
      orderBy: { updatedAt: "asc" },
      take: 6,
      select: {
        id: true,
        title: true,
        status: true,
        objectType: true,
        objectId: true,
        updatedAt: true,
        actor: { select: { name: true } },
      },
    }),
    prisma.assistantActionQueueItem.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        actionKind: true,
        label: true,
        status: true,
        objectType: true,
        objectId: true,
        createdAt: true,
      },
    }),
  ]);

  const groundedCount = recentAuditEvents.filter((event) => event.quality != null || event.evidence != null).length;
  const groundingCoveragePct = percent(groundedCount, recentAuditEvents.length);
  const feedbackMissingCount = Math.max(auditTotal - helpfulCount - needsReviewCount, 0);
  const urgentItems = [
    ...inbox.items.slice(0, 5).map((item) => ({
      id: item.id,
      label: item.title,
      reason: item.suggestedAction?.label ?? item.subtitle ?? "Open assistant inbox work",
      href: item.href,
    })),
    ...pendingActions.slice(0, 4).map((item) => ({
      id: item.id,
      label: item.label,
      reason: item.description ?? "Pending assistant action",
      href: payloadHref(item.payload),
    })),
  ];
  const followUpItems = [
    ...recentAuditEvents
      .filter((event) => event.feedback === "not_helpful")
      .slice(0, 3)
      .map((event) => ({
        id: event.id,
        label: event.prompt,
        reason: "Answer marked Needs review",
        href: null,
      })),
    ...stalePlaybookRuns.slice(0, 3).map((run) => ({
      id: run.id,
      label: run.title,
      reason: "Playbook has been active for more than 7 days",
      href: null,
    })),
  ];
  const objectCoverageMap = new Map<string, { objectType: string; auditEvents: number; actions: number; playbooks: number }>();
  for (const event of recentAuditEvents) {
    const objectType = event.objectType?.trim() || "unknown";
    const existing = objectCoverageMap.get(objectType) ?? { objectType, auditEvents: 0, actions: 0, playbooks: 0 };
    existing.auditEvents += 1;
    objectCoverageMap.set(objectType, existing);
  }
  for (const item of recentActions) {
    const objectType = item.objectType?.trim() || "unknown";
    const existing = objectCoverageMap.get(objectType) ?? { objectType, auditEvents: 0, actions: 0, playbooks: 0 };
    existing.actions += 1;
    objectCoverageMap.set(objectType, existing);
  }
  for (const run of playbookRuns) {
    const objectType = run.objectType?.trim() || "unknown";
    const existing = objectCoverageMap.get(objectType) ?? { objectType, auditEvents: 0, actions: 0, playbooks: 0 };
    existing.playbooks += 1;
    objectCoverageMap.set(objectType, existing);
  }
  const actionKindCounts = new Map<string, number>();
  const completedKindCounts = new Map<string, number>();
  for (const action of recentActions) {
    addCount(actionKindCounts, action.actionKind, "unknown");
    if (action.status === "DONE") addCount(completedKindCounts, action.actionKind, "unknown");
  }
  const automationCandidates = Array.from(actionKindCounts.entries())
    .map(([kind, count]) => ({
      kind,
      recentCount: count,
      completedCount: completedKindCounts.get(kind) ?? 0,
      readinessPct: percent(completedKindCounts.get(kind) ?? 0, count),
    }))
    .sort((a, b) => b.recentCount - a.recentCount)
    .slice(0, 5);
  const confidenceItems = recentAuditEvents.map((event) => {
    const grounded = event.quality != null || event.evidence != null;
    const hasObjectContext = Boolean(event.objectType && event.objectId);
    const score =
      35 +
      (grounded ? 25 : 0) +
      (hasObjectContext ? 15 : 0) +
      (event.feedback === "helpful" ? 20 : 0) -
      (event.feedback === "not_helpful" ? 35 : 0);
    const confidence = score >= 75 ? "high" : score >= 50 ? "medium" : "low";
    return {
      id: event.id,
      prompt: event.prompt,
      answerKind: event.answerKind,
      confidence,
      score: clampScore(score),
      reason: [
        grounded ? "grounded" : "missing grounding",
        hasObjectContext ? "object-linked" : "no object context",
        event.feedback ? `feedback: ${event.feedback}` : "no feedback",
      ].join(" · "),
      createdAt: event.createdAt.toISOString(),
    };
  });
  const confidenceBands = {
    high: confidenceItems.filter((item) => item.confidence === "high").length,
    medium: confidenceItems.filter((item) => item.confidence === "medium").length,
    low: confidenceItems.filter((item) => item.confidence === "low").length,
  };
  const objectlessEvents = recentAuditEvents.filter((event) => !event.objectType || !event.objectId);
  const ungroundedEvents = recentAuditEvents.filter((event) => event.quality == null && event.evidence == null);
  const unknownDomain = objectCoverageMap.get("unknown");
  const pendingActionAgeBuckets = {
    today: pendingActions.filter((item) => ageDays(item.createdAt) <= 1).length,
    threeDays: pendingActions.filter((item) => {
      const age = ageDays(item.createdAt);
      return age > 1 && age <= 3;
    }).length,
    sevenDays: pendingActions.filter((item) => {
      const age = ageDays(item.createdAt);
      return age > 3 && age <= 7;
    }).length,
    older: pendingActions.filter((item) => ageDays(item.createdAt) > 7).length,
  };
  const templateRecommendations = [
    ...Array.from(objectCoverageMap.values())
      .filter((row) => row.auditEvents + row.actions >= 3 && row.playbooks === 0)
      .slice(0, 3)
      .map((row) => ({
        id: `object-${row.objectType}`,
        title: `${row.objectType} follow-up playbook`,
        reason: `${row.auditEvents} answer(s) and ${row.actions} action(s), but no active reusable playbook signal.`,
        priority: row.actions > 0 ? "high" : "medium",
      })),
    ...automationCandidates
      .filter((candidate) => candidate.recentCount >= 2)
      .slice(0, 3)
      .map((candidate) => ({
        id: `action-${candidate.kind}`,
        title: `${candidate.kind} approval checklist`,
        reason: `${candidate.recentCount} recent action(s), ${candidate.readinessPct}% completed.`,
        priority: candidate.readinessPct >= 60 ? "medium" : "high",
      })),
  ].slice(0, 6);
  const feedbackCoveragePct = percent(helpfulCount + needsReviewCount, auditTotal);
  const reviewBacklogPenalty = Math.min(25, needsReviewCount * 4 + feedbackMissingCount * 0.5);
  const stalePenalty = Math.min(20, stalePlaybookCount * 8);
  const rolloutScore = clampScore(
    groundingCoveragePct * 0.35 +
      feedbackCoveragePct * 0.2 +
      percent(doneActionCount, pendingActionCount + doneActionCount) * 0.2 +
      (100 - reviewBacklogPenalty) * 0.15 +
      (100 - stalePenalty) * 0.1,
  );
  const rolloutLevel = rolloutScore >= 80 ? "Ready to expand" : rolloutScore >= 60 ? "Pilot with watchlist" : "Build foundation";
  const recommendations = [
    inbox.total > 0 ? "Start with the oldest high-impact inbox item and queue one explicit next action." : null,
    pendingActionCount > 0 ? "Review pending assistant actions before asking for more automation." : null,
    needsReviewCount > 0 ? "Open recent Needs review answers and tighten grounding or playbooks." : null,
    stalePlaybookCount > 0 ? "Close or refresh stale active playbooks so command-center status stays trustworthy." : null,
    groundingCoveragePct < 80 ? "Improve answer grounding coverage for recent assistant responses." : null,
    rolloutScore < 60 ? "Keep the assistant in guided mode until rollout readiness improves." : null,
  ].filter((item): item is string => Boolean(item));
  const executiveBriefLines = [
    `Assistant brief: ${inbox.total} open inbox item(s), ${pendingActionCount} pending action(s), ${activePlaybookCount} active playbook(s).`,
    `Quality: ${helpfulCount} helpful, ${needsReviewCount} needs review, ${groundingCoveragePct}% recent grounding coverage.`,
    stalePlaybookCount > 0
      ? `Attention: ${stalePlaybookCount} stale playbook(s) need cleanup.`
      : "Attention: no stale playbooks detected.",
    recommendations[0] ? `Recommended next step: ${recommendations[0]}` : "Recommended next step: continue monitoring.",
  ];

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    inbox: {
      total: inbox.total,
      producers: inbox.producers,
      items: inbox.items.slice(0, 8),
    },
    quality: {
      auditTotal,
      feedback: {
        helpful: helpfulCount,
        needsReview: needsReviewCount,
        missing: feedbackMissingCount,
      },
      recentSampleSize: recentAuditEvents.length,
      groundingCoveragePct,
      needsReview: recentAuditEvents
        .filter((event) => event.feedback === "not_helpful")
        .slice(0, 6)
        .map((event) => ({
          id: event.id,
          prompt: event.prompt,
          answerKind: event.answerKind,
          message: event.message,
          objectType: event.objectType,
          objectId: event.objectId,
          createdAt: event.createdAt.toISOString(),
          actorName: event.actor?.name ?? "Assistant user",
        })),
    },
    actionQueue: {
      pendingCount: pendingActionCount,
      doneCount: doneActionCount,
      items: pendingActions.map((item) => ({
        ...item,
        href: payloadHref(item.payload),
        actorName: item.actor?.name ?? "Assistant user",
        createdAt: item.createdAt.toISOString(),
      })),
    },
    playbooks: {
      activeCount: activePlaybookCount,
      completedCount: completedPlaybookCount,
      staleCount: stalePlaybookCount,
      runs: playbookRuns.map((run) => ({
        ...run,
        actorName: run.actor?.name ?? "Assistant user",
        updatedAt: run.updatedAt.toISOString(),
      })),
    },
    memory: {
      recentEvents: recentAuditEvents.slice(0, 10).map((event) => ({
        id: event.id,
        prompt: event.prompt,
        answerKind: event.answerKind,
        message: event.message,
        feedback: event.feedback,
        objectType: event.objectType,
        objectId: event.objectId,
        createdAt: event.createdAt.toISOString(),
        actorName: event.actor?.name ?? "Assistant user",
      })),
    },
    health: {
      auditTotal,
      openInboxCount: inbox.total,
      pendingActionCount,
      activePlaybookCount,
      stalePlaybookCount,
      needsReviewCount,
      groundingCoveragePct,
      recommendations,
    },
    priority: {
      lanes: [
        { id: "urgent", label: "Urgent", count: urgentItems.length, items: urgentItems.slice(0, 6) },
        { id: "active", label: "Active", count: activePlaybookCount, items: playbookRuns.slice(0, 6).map((run) => ({
          id: run.id,
          label: run.title,
          reason: `${run.status} · ${run.objectType ?? "no object"}`,
          href: null,
        })) },
        { id: "follow_up", label: "Follow-up", count: followUpItems.length, items: followUpItems.slice(0, 6) },
      ],
    },
    coverage: {
      objectTypes: Array.from(objectCoverageMap.values()).sort(
        (a, b) => b.auditEvents + b.actions + b.playbooks - (a.auditEvents + a.actions + a.playbooks),
      ),
    },
    automation: {
      pendingCount: pendingActionCount,
      doneCount: doneActionCount,
      completionPct: percent(doneActionCount, pendingActionCount + doneActionCount),
      candidates: automationCandidates,
    },
    reviewQueue: {
      total: needsReviewCount + stalePlaybookCount + feedbackMissingCount,
      needsReviewAnswers: recentAuditEvents
        .filter((event) => event.feedback === "not_helpful")
        .slice(0, 5)
        .map((event) => ({
          id: event.id,
          label: event.prompt,
          reason: "Needs review feedback",
          createdAt: event.createdAt.toISOString(),
        })),
      stalePlaybooks: stalePlaybookRuns.map((run) => ({
        id: run.id,
        label: run.title,
        reason: "Active for more than 7 days",
        updatedAt: run.updatedAt.toISOString(),
        actorName: run.actor?.name ?? "Assistant user",
      })),
      unreviewedMemory: recentAuditEvents
        .filter((event) => event.feedback == null)
        .slice(0, 5)
        .map((event) => ({
          id: event.id,
          label: event.prompt,
          reason: "No feedback captured",
          createdAt: event.createdAt.toISOString(),
        })),
    },
    brief: {
      text: executiveBriefLines.join("\n"),
      lines: executiveBriefLines,
    },
    confidence: {
      bands: confidenceBands,
      sampleSize: confidenceItems.length,
      lowConfidence: confidenceItems
        .filter((item) => item.confidence === "low")
        .sort((a, b) => a.score - b.score)
        .slice(0, 6),
    },
    domainGaps: {
      objectlessCount: objectlessEvents.length,
      ungroundedCount: ungroundedEvents.length,
      unknownDomainCount: unknownDomain ? unknownDomain.auditEvents + unknownDomain.actions + unknownDomain.playbooks : 0,
      examples: [
        ...objectlessEvents.slice(0, 3).map((event) => ({
          id: event.id,
          label: event.prompt,
          reason: "No object context",
          createdAt: event.createdAt.toISOString(),
        })),
        ...ungroundedEvents.slice(0, 3).map((event) => ({
          id: event.id,
          label: event.prompt,
          reason: "No quality/evidence grounding",
          createdAt: event.createdAt.toISOString(),
        })),
      ].slice(0, 6),
    },
    escalationWatch: {
      pendingActionAgeBuckets,
      oldestPendingActions: pendingActions
        .slice()
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, 5)
        .map((item) => ({
          id: item.id,
          label: item.label,
          ageDays: ageDays(item.createdAt),
          objectType: item.objectType,
          objectId: item.objectId,
          href: payloadHref(item.payload),
          actorName: item.actor?.name ?? "Assistant user",
        })),
      stalePlaybooks: stalePlaybookRuns.map((run) => ({
        id: run.id,
        label: run.title,
        ageDays: ageDays(run.updatedAt),
        objectType: run.objectType,
        objectId: run.objectId,
        actorName: run.actor?.name ?? "Assistant user",
      })),
    },
    playbookRecommendations: {
      templates: templateRecommendations,
    },
    rollout: {
      score: rolloutScore,
      level: rolloutLevel,
      checklist: [
        { id: "grounding", label: "Recent grounding coverage at or above 80%", passed: groundingCoveragePct >= 80 },
        { id: "feedback", label: "Feedback captured for at least half of audit events", passed: feedbackCoveragePct >= 50 },
        { id: "actions", label: "No more pending than completed assistant actions", passed: pendingActionCount <= doneActionCount },
        { id: "review", label: "Needs-review answers are below 10% of audit volume", passed: percent(needsReviewCount, auditTotal) < 10 },
        { id: "stale", label: "No stale active playbooks", passed: stalePlaybookCount === 0 },
      ],
    },
  });
}
