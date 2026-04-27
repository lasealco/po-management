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

function sortedCountRows(map: Map<string, number>, limit = 6) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
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
        surface: true,
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
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
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
  const actorRows = new Map<string, { actorName: string; answers: number; actions: number; playbooks: number }>();
  const surfaceCounts = new Map<string, number>();
  const answerKindCounts = new Map<string, number>();
  const todayAnswerCount = recentAuditEvents.filter((event) => event.createdAt >= todayStart).length;
  const todayActionCount = recentActions.filter((action) => action.createdAt >= todayStart).length;
  const todayPlaybookCount = playbookRuns.filter((run) => run.updatedAt >= todayStart).length;
  for (const event of recentAuditEvents) {
    const actorName = event.actor?.name ?? "Assistant user";
    const row = actorRows.get(actorName) ?? { actorName, answers: 0, actions: 0, playbooks: 0 };
    row.answers += 1;
    actorRows.set(actorName, row);
    addCount(surfaceCounts, event.surface, "unknown");
    addCount(answerKindCounts, event.answerKind, "unknown");
  }
  for (const action of recentActions) {
    addCount(actionKindCounts, action.actionKind, "unknown");
    if (action.status === "DONE") addCount(completedKindCounts, action.actionKind, "unknown");
  }
  for (const item of pendingActions) {
    const actorName = item.actor?.name ?? "Assistant user";
    const row = actorRows.get(actorName) ?? { actorName, answers: 0, actions: 0, playbooks: 0 };
    row.actions += 1;
    actorRows.set(actorName, row);
  }
  for (const run of playbookRuns) {
    const actorName = run.actor?.name ?? "Assistant user";
    const row = actorRows.get(actorName) ?? { actorName, answers: 0, actions: 0, playbooks: 0 };
    row.playbooks += 1;
    actorRows.set(actorName, row);
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
  const experimentBacklog = [
    groundingCoveragePct < 80
      ? {
          id: "grounding-coverage",
          title: "Improve answer grounding coverage",
          reason: `${groundingCoveragePct}% recent grounding coverage; target is 80%+.`,
          priority: "high",
        }
      : null,
    objectlessEvents.length > 0
      ? {
          id: "object-context",
          title: "Improve object context inference",
          reason: `${objectlessEvents.length} recent answer(s) lack object context.`,
          priority: "high",
        }
      : null,
    pendingActionCount > doneActionCount
      ? {
          id: "action-close-loop",
          title: "Close the assistant action loop",
          reason: `${pendingActionCount} pending action(s) vs ${doneActionCount} done.`,
          priority: "medium",
        }
      : null,
    ...templateRecommendations.map((item) => ({
      id: item.id,
      title: item.title,
      reason: item.reason,
      priority: item.priority,
    })),
    ...automationCandidates.slice(0, 2).map((candidate) => ({
      id: `automation-${candidate.kind}`,
      title: `Pilot assisted ${candidate.kind}`,
      reason: `${candidate.recentCount} recent action(s), ${candidate.readinessPct}% completion.`,
      priority: candidate.readinessPct >= 60 ? "medium" : "high",
    })),
  ]
    .filter((item): item is { id: string; title: string; reason: string; priority: string } => Boolean(item))
    .slice(0, 8);
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
  const riskRegister = [
    confidenceBands.low > 0
      ? {
          id: "low-confidence",
          severity: "high",
          title: "Low-confidence answers need review",
          signal: `${confidenceBands.low} low-confidence answer(s) in the recent sample.`,
          mitigation: "Review the prompts, add grounding, and convert repeat cases into playbooks.",
        }
      : null,
    groundingCoveragePct < 80
      ? {
          id: "grounding-gap",
          severity: "high",
          title: "Grounding coverage below target",
          signal: `${groundingCoveragePct}% recent grounding coverage.`,
          mitigation: "Require evidence links for operational answers before expanding usage.",
        }
      : null,
    pendingActionCount > doneActionCount
      ? {
          id: "action-backlog",
          severity: "medium",
          title: "Assistant action backlog is growing",
          signal: `${pendingActionCount} pending vs ${doneActionCount} done action(s).`,
          mitigation: "Close or reject stale queued actions before adding more automation.",
        }
      : null,
    stalePlaybookCount > 0
      ? {
          id: "stale-playbooks",
          severity: "medium",
          title: "Active playbooks are stale",
          signal: `${stalePlaybookCount} active playbook(s) older than seven days.`,
          mitigation: "Refresh, complete, or cancel old playbook runs.",
        }
      : null,
    objectlessEvents.length > 0
      ? {
          id: "objectless-memory",
          severity: "low",
          title: "Assistant memory lacks object context",
          signal: `${objectlessEvents.length} recent answer(s) lack object context.`,
          mitigation: "Improve prompt/evidence parsing so memory lands on the correct object.",
        }
      : null,
  ].filter((item): item is { id: string; severity: string; title: string; signal: string; mitigation: string } => Boolean(item));
  const handoffQueue = [
    ...pendingActions.slice(0, 5).map((item) => ({
      id: `action-${item.id}`,
      type: "Queued action",
      title: item.label,
      detail: item.description ?? "Pending assistant action",
      href: payloadHref(item.payload),
      ownerHint: item.actor?.name ?? "Assistant user",
    })),
    ...inbox.items.slice(0, 5).map((item) => ({
      id: `inbox-${item.id}`,
      type: "Inbox work",
      title: item.title,
      detail: item.suggestedAction?.label ?? item.subtitle ?? "Open assistant inbox work",
      href: item.href,
      ownerHint: "Ops owner",
    })),
    ...confidenceItems
      .filter((item) => item.confidence === "low")
      .slice(0, 4)
      .map((item) => ({
        id: `confidence-${item.id}`,
        type: "Review",
        title: item.prompt,
        detail: item.reason,
        href: null,
        ownerHint: "Assistant reviewer",
      })),
  ].slice(0, 10);
  const evidenceNeeded = recentAuditEvents
    .filter((event) => event.quality == null && event.evidence == null)
    .slice(0, 6)
    .map((event) => ({
      id: event.id,
      prompt: event.prompt,
      answerKind: event.answerKind,
      createdAt: event.createdAt.toISOString(),
    }));
  const milestonePlan = [
    {
      horizon: "Now",
      title: riskRegister[0]?.title ?? experimentBacklog[0]?.title ?? "Keep command center operating cadence",
      detail:
        riskRegister[0]?.mitigation ??
        experimentBacklog[0]?.reason ??
        "Run the daily checklist and review open assistant work.",
    },
    {
      horizon: "Next",
      title: experimentBacklog[1]?.title ?? "Turn repeated assistant work into playbooks",
      detail: experimentBacklog[1]?.reason ?? "Use scenario coverage and action history to choose the next guided workflow.",
    },
    {
      horizon: "Later",
      title: rolloutScore >= 80 ? "Expand pilot audience" : "Raise rollout readiness",
      detail:
        rolloutScore >= 80
          ? "Readiness is strong enough to broaden usage with monitoring."
          : `Current rollout score is ${rolloutScore}; close review, grounding, and stale-work gaps first.`,
    },
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
    adoption: {
      actors: Array.from(actorRows.values())
        .map((row) => ({ ...row, total: row.answers + row.actions + row.playbooks }))
        .sort((a, b) => b.total - a.total || a.actorName.localeCompare(b.actorName))
        .slice(0, 8),
    },
    surfaceMix: {
      surfaces: sortedCountRows(surfaceCounts),
      primarySurface: sortedCountRows(surfaceCounts, 1)[0]?.label ?? "none",
    },
    scenarioCoverage: {
      answerKinds: sortedCountRows(answerKindCounts),
      objectTypes: Array.from(objectCoverageMap.values())
        .map((row) => ({
          label: row.objectType,
          count: row.auditEvents + row.actions + row.playbooks,
          auditEvents: row.auditEvents,
          actions: row.actions,
          playbooks: row.playbooks,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 6),
    },
    experiments: {
      backlog: experimentBacklog,
    },
    operatingCadence: {
      today: {
        answers: todayAnswerCount,
        actions: todayActionCount,
        playbooks: todayPlaybookCount,
      },
      checklist: [
        { id: "review", label: "Review Needs review answers", count: needsReviewCount, href: "/assistant/command-center" },
        { id: "actions", label: "Close pending assistant actions", count: pendingActionCount, href: "/assistant/command-center" },
        { id: "inbox", label: "Work assistant inbox items", count: inbox.total, href: "/assistant/inbox" },
        { id: "playbooks", label: "Refresh stale playbooks", count: stalePlaybookCount, href: "/assistant/command-center" },
      ],
      nextStep: recommendations[0] ?? experimentBacklog[0]?.title ?? "Continue monitoring assistant operations.",
    },
    operatingPacket: {
      text: [
        `Today: ${todayAnswerCount} answer(s), ${todayActionCount} action(s), ${todayPlaybookCount} playbook update(s).`,
        `Rollout: ${rolloutScore}/100 (${rolloutLevel}).`,
        `Risk: ${riskRegister[0]?.title ?? "No major assistant risk flagged."}`,
        `Next: ${recommendations[0] ?? experimentBacklog[0]?.title ?? "Continue monitoring assistant operations."}`,
      ].join("\n"),
      lines: [
        `Today: ${todayAnswerCount} answer(s), ${todayActionCount} action(s), ${todayPlaybookCount} playbook update(s).`,
        `Rollout: ${rolloutScore}/100 (${rolloutLevel}).`,
        `Risk: ${riskRegister[0]?.title ?? "No major assistant risk flagged."}`,
        `Next: ${recommendations[0] ?? experimentBacklog[0]?.title ?? "Continue monitoring assistant operations."}`,
      ],
    },
    riskRegister: {
      risks: riskRegister,
    },
    handoff: {
      items: handoffQueue,
    },
    evidenceLedger: {
      groundedCount,
      ungroundedCount: ungroundedEvents.length,
      coveragePct: groundingCoveragePct,
      evidenceNeeded,
    },
    milestonePlan: {
      milestones: milestonePlan,
    },
  });
}
