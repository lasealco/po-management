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

function formatIsoDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function dataScore(value: number, target: number) {
  return clampScore(percent(value, target));
}

function reviewQueuePenalty(needsReviewCount: number, stalePlaybookCount: number) {
  return needsReviewCount * 5 + stalePlaybookCount * 8;
}

function domainGapsReady(objectlessCount: number, ungroundedCount: number) {
  return objectlessCount + ungroundedCount > 0;
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
  const playbookCompletionPct = percent(completedPlaybookCount, activePlaybookCount + completedPlaybookCount);
  const actionCompletionPct = percent(doneActionCount, pendingActionCount + doneActionCount);
  const slaStatus =
    stalePlaybookCount > 0 || pendingActionAgeBuckets.older > 0
      ? "At risk"
      : pendingActionCount > doneActionCount || inbox.total > 10
        ? "Watch"
        : "Healthy";
  const promptCounts = new Map<string, number>();
  for (const event of recentAuditEvents) {
    addCount(promptCounts, event.prompt.trim().toLowerCase(), "unknown");
  }
  const duplicatePromptCount = Array.from(promptCounts.values()).filter((count) => count > 1).length;
  const trainingPositive = recentAuditEvents
    .filter((event) => event.feedback === "helpful" && (event.quality != null || event.evidence != null))
    .slice(0, 5)
    .map((event) => ({
      id: event.id,
      prompt: event.prompt,
      answerKind: event.answerKind,
      reason: "Helpful and grounded",
      createdAt: event.createdAt.toISOString(),
    }));
  const trainingCorrections = [
    ...recentAuditEvents
      .filter((event) => event.feedback === "not_helpful")
      .slice(0, 4)
      .map((event) => ({
        id: event.id,
        prompt: event.prompt,
        answerKind: event.answerKind,
        reason: "Marked Needs review",
        createdAt: event.createdAt.toISOString(),
      })),
    ...ungroundedEvents.slice(0, 4).map((event) => ({
      id: event.id,
      prompt: event.prompt,
      answerKind: event.answerKind,
      reason: "Missing grounding",
      createdAt: event.createdAt.toISOString(),
    })),
  ].slice(0, 6);
  const promptLibraryCandidates = [
    ...sortedCountRows(answerKindCounts, 4).map((row) => ({
      id: `kind-${row.label}`,
      title: `${row.label} starter`,
      prompt: `Ask assistant for a ${row.label} answer with evidence and next action.`,
      reason: `${row.count} recent answer(s) use this pattern.`,
    })),
    ...Array.from(objectCoverageMap.values())
      .filter((row) => row.auditEvents > 0)
      .slice(0, 4)
      .map((row) => ({
        id: `object-${row.objectType}`,
        title: `${row.objectType} review`,
        prompt: `Summarize this ${row.objectType}, cite evidence, and propose the next human-approved action.`,
        reason: `${row.auditEvents} answer(s) linked to this object type.`,
      })),
  ].slice(0, 6);
  const decisionJournal = [
    ...recentAuditEvents
      .filter((event) => event.feedback != null)
      .slice(0, 6)
      .map((event) => ({
        id: `feedback-${event.id}`,
        type: "Feedback",
        label: event.feedback === "helpful" ? "Answer marked helpful" : "Answer needs review",
        detail: event.prompt,
        at: event.createdAt.toISOString(),
      })),
    ...recentActions.slice(0, 6).map((action) => ({
      id: `action-${action.id}`,
      type: "Action",
      label: action.status,
      detail: action.label,
      at: action.createdAt.toISOString(),
    })),
    ...playbookRuns.slice(0, 6).map((run) => ({
      id: `playbook-${run.id}`,
      type: "Playbook",
      label: run.status,
      detail: run.title,
      at: run.updatedAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 10);
  const signalHygieneItems = [
    duplicatePromptCount > 0
      ? {
          id: "duplicate-prompts",
          label: "Repeated prompts",
          count: duplicatePromptCount,
          recommendation: "Convert repeated prompts into prompt-library starters or playbooks.",
        }
      : null,
    feedbackMissingCount > 0
      ? {
          id: "missing-feedback",
          label: "Missing feedback",
          count: feedbackMissingCount,
          recommendation: "Capture Helpful / Needs review on recent assistant answers.",
        }
      : null,
    ungroundedEvents.length > 0
      ? {
          id: "missing-grounding",
          label: "Missing grounding",
          count: ungroundedEvents.length,
          recommendation: "Require evidence links or quality metadata before relying on answers.",
        }
      : null,
    objectlessEvents.length > 0
      ? {
          id: "unlinked-memory",
          label: "Unlinked memory",
          count: objectlessEvents.length,
          recommendation: "Improve object inference so memory attaches to records.",
        }
      : null,
  ].filter((item): item is { id: string; label: string; count: number; recommendation: string } => Boolean(item));
  const programLayers = [
    {
      id: "mp50-mp54",
      range: "MP50-MP54",
      title: "Governance baseline",
      score: rolloutScore,
      summary: "Control baseline for expanding assistant usage without silent automation.",
      items: [
        {
          mp: "MP50",
          label: "Governance baseline scorecard",
          status: rolloutScore >= 60 ? "ready" : "watch",
          detail: `Rollout readiness is ${rolloutScore}/100 with ${groundingCoveragePct}% grounding coverage.`,
        },
        {
          mp: "MP51",
          label: "Control objectives",
          status: riskRegister.length === 0 ? "ready" : "watch",
          detail: `${riskRegister.length} control risk(s) currently flagged.`,
        },
        {
          mp: "MP52",
          label: "Access posture",
          status: canCt && canOrders ? "ready" : "watch",
          detail: `Command center includes ${canCt ? "Control Tower" : "no Control Tower"} and ${canOrders ? "Orders" : "no Orders"} scope.`,
        },
        {
          mp: "MP53",
          label: "Retention and sampling plan",
          status: recentAuditEvents.length >= 10 ? "ready" : "watch",
          detail: `${recentAuditEvents.length} recent audit event(s) sampled from ${auditTotal} total.`,
        },
        {
          mp: "MP54",
          label: "Approval gate posture",
          status: pendingActionCount <= doneActionCount ? "ready" : "watch",
          detail: `${pendingActionCount} pending action(s), ${doneActionCount} done action(s).`,
        },
      ],
    },
    {
      id: "mp55-mp59",
      range: "MP55-MP59",
      title: "Value realization",
      score: clampScore((helpfulCount + doneActionCount + completedPlaybookCount) * 10 - pendingActionCount * 3),
      summary: "Lightweight value signals from answer usefulness, completed actions, and workflow throughput.",
      items: [
        {
          mp: "MP55",
          label: "Value proxy",
          status: helpfulCount + doneActionCount > 0 ? "ready" : "watch",
          detail: `${helpfulCount} helpful answer(s), ${doneActionCount} completed action(s).`,
        },
        {
          mp: "MP56",
          label: "Cycle-time proxy",
          status: stalePlaybookCount === 0 && pendingActionAgeBuckets.older === 0 ? "ready" : "watch",
          detail: `${stalePlaybookCount} stale playbook(s), ${pendingActionAgeBuckets.older} action(s) older than 7 days.`,
        },
        {
          mp: "MP57",
          label: "Capacity proxy",
          status: inbox.total + pendingActionCount < 15 ? "ready" : "watch",
          detail: `${inbox.total} inbox item(s), ${pendingActionCount} pending action(s).`,
        },
        {
          mp: "MP58",
          label: "Deflection signal",
          status: trainingPositive.length > 0 ? "ready" : "watch",
          detail: `${trainingPositive.length} helpful grounded answer(s) available as self-service examples.`,
        },
        {
          mp: "MP59",
          label: "Value backlog",
          status: experimentBacklog.length > 0 ? "ready" : "watch",
          detail: `${experimentBacklog.length} experiment(s) available for value improvement.`,
        },
      ],
    },
    {
      id: "mp60-mp64",
      range: "MP60-MP64",
      title: "Domain expansion",
      score: clampScore(dataScore(objectCoverageMap.size, 8) * 0.5 + groundingCoveragePct * 0.5),
      summary: "Expansion candidates based on object coverage, surface usage, evidence debt, and playbook gaps.",
      items: [
        {
          mp: "MP60",
          label: "Domain expansion ranking",
          status: objectCoverageMap.size > 1 ? "ready" : "watch",
          detail: `${objectCoverageMap.size} object domain(s) represented in recent assistant data.`,
        },
        {
          mp: "MP61",
          label: "Data dependency map",
          status: ungroundedEvents.length === 0 && objectlessEvents.length === 0 ? "ready" : "watch",
          detail: `${ungroundedEvents.length} ungrounded answer(s), ${objectlessEvents.length} objectless answer(s).`,
        },
        {
          mp: "MP62",
          label: "Integration readiness",
          status: surfaceCounts.size > 1 || recentActions.length > 0 ? "ready" : "watch",
          detail: `${surfaceCounts.size} surface(s), ${recentActions.length} recent action event(s).`,
        },
        {
          mp: "MP63",
          label: "Workflow gap map",
          status: templateRecommendations.length > 0 ? "ready" : "watch",
          detail: `${templateRecommendations.length} reusable workflow/template candidate(s).`,
        },
        {
          mp: "MP64",
          label: "Expansion cards",
          status: objectCoverageMap.size > 0 ? "ready" : "watch",
          detail: `${Array.from(objectCoverageMap.keys()).slice(0, 3).join(", ") || "No domain candidates yet"}.`,
        },
      ],
    },
    {
      id: "mp65-mp69",
      range: "MP65-MP69",
      title: "Scale operations",
      score: clampScore((rolloutScore + actionCompletionPct + playbookCompletionPct + groundingCoveragePct) / 4),
      summary: "Scale plan that turns adoption, incidents, KPIs, and milestones into a 30-day operating roadmap.",
      items: [
        {
          mp: "MP65",
          label: "Enablement plan",
          status: actorRows.size > 0 && promptLibraryCandidates.length > 0 ? "ready" : "watch",
          detail: `${actorRows.size} actor(s), ${promptLibraryCandidates.length} prompt starter(s).`,
        },
        {
          mp: "MP66",
          label: "Release train",
          status: milestonePlan.length >= 3 ? "ready" : "watch",
          detail: `${milestonePlan.length} milestone horizon(s) available.`,
        },
        {
          mp: "MP67",
          label: "Incident runbook",
          status: riskRegister.length > 0 ? "ready" : "watch",
          detail: `${riskRegister.length} risk(s) mapped to mitigation steps.`,
        },
        {
          mp: "MP68",
          label: "KPI board",
          status: "ready",
          detail: `Rollout ${rolloutScore}, action completion ${actionCompletionPct}%, evidence ${groundingCoveragePct}%.`,
        },
        {
          mp: "MP69",
          label: "30-day operating roadmap",
          status: experimentBacklog.length > 0 || riskRegister.length > 0 ? "ready" : "watch",
          detail: `Next: ${milestonePlan[0]?.title ?? "Continue monitoring assistant operations"}.`,
        },
      ],
    },
  ];
  const maturityLayers = [
    {
      id: "mp70-mp74",
      range: "MP70-MP74",
      title: "Process intelligence",
      score: clampScore((surfaceCounts.size * 12) + (answerKindCounts.size * 8) - reviewQueuePenalty(needsReviewCount, stalePlaybookCount)),
      summary: "Turns assistant telemetry into process paths, bottlenecks, exception categories, root-cause hints, and improvement queues.",
      items: [
        {
          mp: "MP70",
          label: "Process mining signal",
          status: recentAuditEvents.length + recentActions.length + playbookRuns.length > 0 ? "ready" : "watch",
          detail: `${recentAuditEvents.length} answer(s), ${recentActions.length} action(s), ${playbookRuns.length} playbook run(s) in the current sample.`,
        },
        {
          mp: "MP71",
          label: "Bottleneck detector",
          status: needsReviewCount + stalePlaybookCount + pendingActionAgeBuckets.older === 0 ? "ready" : "watch",
          detail: `${needsReviewCount} needs-review answer(s), ${stalePlaybookCount} stale playbook(s), ${pendingActionAgeBuckets.older} older action(s).`,
        },
        {
          mp: "MP72",
          label: "Exception taxonomy",
          status: riskRegister.length + ungroundedEvents.length + pendingActionCount > 0 ? "ready" : "watch",
          detail: `${riskRegister.length} risk group(s), ${ungroundedEvents.length} evidence gap(s), ${pendingActionCount} pending action(s).`,
        },
        {
          mp: "MP73",
          label: "Root-cause hints",
          status: domainGapsReady(objectlessEvents.length, ungroundedEvents.length) ? "ready" : "watch",
          detail: `${objectlessEvents.length} object-context gap(s), ${ungroundedEvents.length} grounding gap(s).`,
        },
        {
          mp: "MP74",
          label: "Process recommendation queue",
          status: recommendations.length + experimentBacklog.length > 0 ? "ready" : "watch",
          detail: `${recommendations.length} recommendation(s), ${experimentBacklog.length} experiment(s).`,
        },
      ],
    },
    {
      id: "mp75-mp79",
      range: "MP75-MP79",
      title: "Knowledge system",
      score: clampScore((trainingPositive.length + promptLibraryCandidates.length + templateRecommendations.length) * 10 + groundingCoveragePct * 0.4),
      summary: "Packages helpful answers, SOP gaps, evidence needs, and freshness signals into a lightweight knowledge program.",
      items: [
        {
          mp: "MP75",
          label: "Knowledge base candidates",
          status: trainingPositive.length + promptLibraryCandidates.length > 0 ? "ready" : "watch",
          detail: `${trainingPositive.length} positive example(s), ${promptLibraryCandidates.length} prompt candidate(s).`,
        },
        {
          mp: "MP76",
          label: "SOP gap list",
          status: templateRecommendations.length > 0 ? "ready" : "watch",
          detail: `${templateRecommendations.length} missing or reusable SOP candidate(s).`,
        },
        {
          mp: "MP77",
          label: "Answer-to-playbook mapping",
          status: answerKindCounts.size > 0 ? "ready" : "watch",
          detail: `${answerKindCounts.size} answer pattern(s) available for playbook mapping.`,
        },
        {
          mp: "MP78",
          label: "Evidence starter packs",
          status: evidenceNeeded.length > 0 || groundingCoveragePct >= 80 ? "ready" : "watch",
          detail: `${evidenceNeeded.length} evidence-needed prompt(s), ${groundingCoveragePct}% grounding coverage.`,
        },
        {
          mp: "MP79",
          label: "Knowledge freshness",
          status: recentAuditEvents.length > 0 ? "ready" : "watch",
          detail: `${recentAuditEvents.length} recent audit sample(s); generated ${new Date().toISOString()}.`,
        },
      ],
    },
    {
      id: "mp80-mp84",
      range: "MP80-MP84",
      title: "Automation rehearsal",
      score: clampScore((rolloutScore + actionCompletionPct + groundingCoveragePct - pendingActionAgeBuckets.older * 10) / 3),
      summary: "Keeps automation in shadow mode with controlled candidates, rollback checks, and guardrails.",
      items: [
        {
          mp: "MP80",
          label: "Simulation readiness",
          status: rolloutScore >= 60 && groundingCoveragePct >= 70 ? "ready" : "watch",
          detail: `Rollout ${rolloutScore}/100, grounding ${groundingCoveragePct}%.`,
        },
        {
          mp: "MP81",
          label: "Shadow-mode score",
          status: pendingActionCount + doneActionCount > 0 ? "ready" : "watch",
          detail: `${doneActionCount} completed human-approved action(s), ${pendingActionCount} pending.`,
        },
        {
          mp: "MP82",
          label: "Controlled automation candidates",
          status: automationCandidates.length > 0 ? "ready" : "watch",
          detail: `${automationCandidates.length} action kind(s) ready for review.`,
        },
        {
          mp: "MP83",
          label: "Rollback checklist",
          status: riskRegister.length > 0 || handoffQueue.length > 0 ? "ready" : "watch",
          detail: `${riskRegister.length} risk(s), ${handoffQueue.length} handoff item(s) to verify before expansion.`,
        },
        {
          mp: "MP84",
          label: "Automation guardrails",
          status: pendingActionCount <= doneActionCount && groundingCoveragePct >= 80 && feedbackCoveragePct >= 50 ? "ready" : "watch",
          detail: `Approval balance ${pendingActionCount}/${doneActionCount}, feedback ${feedbackCoveragePct}%, grounding ${groundingCoveragePct}%.`,
        },
      ],
    },
    {
      id: "mp85-mp89",
      range: "MP85-MP89",
      title: "Stakeholder experience",
      score: clampScore((actorRows.size * 12) + (promptLibraryCandidates.length * 8) + groundingCoveragePct * 0.4),
      summary: "Turns command-center signals into stakeholder maps, communication packs, coaching queues, and board-ready reporting.",
      items: [
        {
          mp: "MP85",
          label: "Stakeholder experience map",
          status: actorRows.size > 0 || objectCoverageMap.size > 0 ? "ready" : "watch",
          detail: `${actorRows.size} actor(s), ${objectCoverageMap.size} object domain(s) represented.`,
        },
        {
          mp: "MP86",
          label: "Communication pack",
          status: executiveBriefLines.length > 0 && promptLibraryCandidates.length > 0 ? "ready" : "watch",
          detail: `${executiveBriefLines.length} executive brief line(s), ${promptLibraryCandidates.length} prompt starter(s).`,
        },
        {
          mp: "MP87",
          label: "Brief variants",
          status: "ready",
          detail: "Executive brief, operating packet, and enablement prompts are available from the same signal set.",
        },
        {
          mp: "MP88",
          label: "Adoption coaching queue",
          status: actorRows.size > 0 && promptLibraryCandidates.length > 0 ? "ready" : "watch",
          detail: `${actorRows.size} adoption row(s), ${promptLibraryCandidates.length} coaching prompt(s).`,
        },
        {
          mp: "MP89",
          label: "Board-ready narrative",
          status: rolloutScore >= 50 || auditTotal > 0 ? "ready" : "watch",
          detail: `Readiness ${rolloutScore}/100 with ${auditTotal} total audit event(s) and ${riskRegister.length} risk(s).`,
        },
      ],
    },
  ];
  const coveredObjectTypes = Array.from(objectCoverageMap.keys()).map((value) => value.toLowerCase());
  const hasCoverage = (...keywords: string[]) =>
    coveredObjectTypes.some((type) => keywords.some((keyword) => type.includes(keyword)));
  const reviewDebt = needsReviewCount + feedbackMissingCount + stalePlaybookCount;
  const horizonLayers = [
    {
      id: "mp90-mp94",
      range: "MP90-MP94",
      title: "Predictive operations",
      score: clampScore(rolloutScore * 0.45 + groundingCoveragePct * 0.35 - reviewDebt * 3),
      summary: "Early-warning signals from stale work, risk, demand patterns, exceptions, and next monitoring steps.",
      items: [
        {
          mp: "MP90",
          label: "Predictive signal board",
          status: confidenceItems.length > 0 || riskRegister.length > 0 ? "ready" : "watch",
          detail: `${confidenceItems.length} confidence sample(s), ${riskRegister.length} risk signal(s).`,
        },
        {
          mp: "MP91",
          label: "Delay risk proxy",
          status: stalePlaybookCount === 0 && pendingActionAgeBuckets.older === 0 ? "ready" : "watch",
          detail: `${stalePlaybookCount} stale playbook(s), ${pendingActionAgeBuckets.older} action(s) older than 7 days.`,
        },
        {
          mp: "MP92",
          label: "Demand signal proxy",
          status: surfaceCounts.size > 0 || duplicatePromptCount > 0 ? "ready" : "watch",
          detail: `${surfaceCounts.size} surface(s), ${duplicatePromptCount} duplicate prompt pattern(s).`,
        },
        {
          mp: "MP93",
          label: "Exception forecast",
          status: riskRegister.length + objectlessEvents.length + ungroundedEvents.length > 0 ? "ready" : "watch",
          detail: `${riskRegister.length} risk(s), ${objectlessEvents.length + ungroundedEvents.length} domain-gap example(s).`,
        },
        {
          mp: "MP94",
          label: "Predictive next step",
          status: recommendations.length + experimentBacklog.length > 0 ? "ready" : "watch",
          detail: `Next: ${recommendations[0] ?? experimentBacklog[0]?.title ?? "Keep collecting assistant telemetry"}.`,
        },
      ],
    },
    {
      id: "mp95-mp99",
      range: "MP95-MP99",
      title: "Data quality and trust",
      score: clampScore(groundingCoveragePct * 0.5 + feedbackCoveragePct * 0.3 + dataScore(objectCoverageMap.size, 8) * 0.2),
      summary: "Trust layer for feedback quality, object links, grounding, audit completeness, and noisy-signal cleanup.",
      items: [
        {
          mp: "MP95",
          label: "Data quality scorecard",
          status: signalHygieneItems.length === 0 ? "ready" : "watch",
          detail: `${signalHygieneItems.length} hygiene item(s), ${feedbackMissingCount} missing feedback item(s).`,
        },
        {
          mp: "MP96",
          label: "Object link quality",
          status: objectlessEvents.length === 0 && objectCoverageMap.size > 0 ? "ready" : "watch",
          detail: `${objectCoverageMap.size} linked object type(s), ${objectlessEvents.length} objectless event(s).`,
        },
        {
          mp: "MP97",
          label: "Feedback quality",
          status: feedbackCoveragePct >= 50 && needsReviewCount < helpfulCount + 1 ? "ready" : "watch",
          detail: `${feedbackCoveragePct}% feedback coverage, ${needsReviewCount} needs-review answer(s).`,
        },
        {
          mp: "MP98",
          label: "Grounding quality",
          status: groundingCoveragePct >= 80 ? "ready" : "watch",
          detail: `${groundedCount} grounded answer(s), ${ungroundedEvents.length} ungrounded answer(s).`,
        },
        {
          mp: "MP99",
          label: "Duplicate signal cleanup",
          status: duplicatePromptCount === 0 ? "ready" : "watch",
          detail: `${duplicatePromptCount} duplicate prompt pattern(s) to consolidate.`,
        },
      ],
    },
    {
      id: "mp100-mp104",
      range: "MP100-MP104",
      title: "Agent orchestration",
      score: clampScore((recentAuditEvents.length > 0 ? 20 : 0) + (recentActions.length > 0 ? 20 : 0) + (playbookRuns.length > 0 ? 20 : 0) + actionCompletionPct * 0.4),
      summary: "Maps answer, action, playbook, handoff, and boundary signals into one orchestration picture.",
      items: [
        {
          mp: "MP100",
          label: "Agent orchestration map",
          status: recentAuditEvents.length + recentActions.length + playbookRuns.length > 0 ? "ready" : "watch",
          detail: `${recentAuditEvents.length} answer(s), ${recentActions.length} action(s), ${playbookRuns.length} playbook(s).`,
        },
        {
          mp: "MP101",
          label: "Tool-use readiness",
          status: actionCompletionPct >= 50 || automationCandidates.length > 0 ? "ready" : "watch",
          detail: `${actionCompletionPct}% action completion, ${automationCandidates.length} candidate action kind(s).`,
        },
        {
          mp: "MP102",
          label: "Playbook orchestration",
          status: activePlaybookCount + completedPlaybookCount > 0 ? "ready" : "watch",
          detail: `${activePlaybookCount} active, ${completedPlaybookCount} completed, ${stalePlaybookCount} stale.`,
        },
        {
          mp: "MP103",
          label: "Human-in-loop routing",
          status: handoffQueue.length > 0 || reviewDebt === 0 ? "ready" : "watch",
          detail: `${handoffQueue.length} handoff item(s), ${reviewDebt} review/stale debt item(s).`,
        },
        {
          mp: "MP104",
          label: "Agent boundary map",
          status: confidenceItems.length > 0 || ungroundedEvents.length > 0 ? "ready" : "watch",
          detail: `${confidenceItems.filter((item) => item.confidence === "low").length} low-confidence answer(s), ${ungroundedEvents.length} ungrounded.`,
        },
      ],
    },
    {
      id: "mp105-mp109",
      range: "MP105-MP109",
      title: "Collaboration intelligence",
      score: clampScore(dataScore(objectCoverageMap.size, 6) * 0.35 + dataScore(handoffQueue.length, 8) * 0.25 + groundingCoveragePct * 0.4),
      summary: "Customer, supplier, carrier, communication, and collaboration-risk signals for external workflows.",
      items: [
        {
          mp: "MP105",
          label: "Customer collaboration lens",
          status: hasCoverage("customer", "sales", "order", "mail") ? "ready" : "watch",
          detail: hasCoverage("customer", "sales", "order", "mail") ? "Customer/order signals are present." : "No customer/order collaboration signal yet.",
        },
        {
          mp: "MP106",
          label: "Supplier collaboration lens",
          status: hasCoverage("supplier", "srm") ? "ready" : "watch",
          detail: hasCoverage("supplier", "srm") ? "Supplier/SRM signals are present." : "No supplier collaboration signal yet.",
        },
        {
          mp: "MP107",
          label: "Carrier collaboration lens",
          status: hasCoverage("shipment", "carrier", "control") ? "ready" : "watch",
          detail: hasCoverage("shipment", "carrier", "control") ? "Shipment/carrier signals are present." : "No carrier collaboration signal yet.",
        },
        {
          mp: "MP108",
          label: "Collaboration packet",
          status: executiveBriefLines.length > 0 && promptLibraryCandidates.length > 0 ? "ready" : "watch",
          detail: `${executiveBriefLines.length} brief line(s), ${promptLibraryCandidates.length} prompt starter(s).`,
        },
        {
          mp: "MP109",
          label: "Collaboration risk watch",
          status: riskRegister.length + ungroundedEvents.length + stalePlaybookCount > 0 ? "ready" : "watch",
          detail: `${riskRegister.length} risk(s), ${ungroundedEvents.length} grounding gap(s), ${stalePlaybookCount} stale playbook(s).`,
        },
      ],
    },
    {
      id: "mp110-mp114",
      range: "MP110-MP114",
      title: "Commercial intelligence",
      score: clampScore((helpfulCount + doneActionCount + automationCandidates.length) * 8 + groundingCoveragePct * 0.35 - reviewDebt * 2),
      summary: "Commercial impact, pricing, invoice, service-cost, and margin-risk signals from assistant activity.",
      items: [
        {
          mp: "MP110",
          label: "Commercial impact lens",
          status: helpfulCount + doneActionCount > 0 ? "ready" : "watch",
          detail: `${helpfulCount} helpful answer(s), ${doneActionCount} completed action(s).`,
        },
        {
          mp: "MP111",
          label: "Pricing assistance watch",
          status: hasCoverage("price", "pricing", "tariff", "rfq") ? "ready" : "watch",
          detail: hasCoverage("price", "pricing", "tariff", "rfq") ? "Pricing/tariff signals are present." : "No pricing assistance signal yet.",
        },
        {
          mp: "MP112",
          label: "Invoice assistance watch",
          status: hasCoverage("invoice", "audit") ? "ready" : "watch",
          detail: hasCoverage("invoice", "audit") ? "Invoice audit signals are present." : "No invoice assistance signal yet.",
        },
        {
          mp: "MP113",
          label: "Cost-to-serve proxy",
          status: inbox.total + pendingActionCount + reviewDebt < 20 ? "ready" : "watch",
          detail: `${inbox.total} inbox item(s), ${pendingActionCount} pending action(s), ${reviewDebt} review/stale debt item(s).`,
        },
        {
          mp: "MP114",
          label: "Margin-risk hints",
          status: riskRegister.length + confidenceBands.low + ungroundedEvents.length > 0 ? "ready" : "watch",
          detail: `${confidenceBands.low} low-confidence answer(s), ${ungroundedEvents.length} evidence gap(s), ${riskRegister.length} risk(s).`,
        },
      ],
    },
    {
      id: "mp115-mp119",
      range: "MP115-MP119",
      title: "Operational intelligence",
      score: clampScore(dataScore(objectCoverageMap.size, 8) * 0.35 + dataScore(inbox.total + pendingActionCount, 20) * 0.25 + groundingCoveragePct * 0.4),
      summary: "Warehouse, logistics, inventory, load, and resilience signals for operational work.",
      items: [
        {
          mp: "MP115",
          label: "Warehouse intelligence lens",
          status: hasCoverage("warehouse", "wms") ? "ready" : "watch",
          detail: hasCoverage("warehouse", "wms") ? "Warehouse/WMS signals are present." : "No warehouse signal yet.",
        },
        {
          mp: "MP116",
          label: "Logistics intelligence lens",
          status: hasCoverage("shipment", "control", "logistics") ? "ready" : "watch",
          detail: hasCoverage("shipment", "control", "logistics") ? "Shipment/logistics signals are present." : "No logistics signal yet.",
        },
        {
          mp: "MP117",
          label: "Inventory intelligence lens",
          status: hasCoverage("inventory", "product", "stock") ? "ready" : "watch",
          detail: hasCoverage("inventory", "product", "stock") ? "Inventory/product signals are present." : "No inventory signal yet.",
        },
        {
          mp: "MP118",
          label: "Operational load board",
          status: inbox.total + pendingActionCount + stalePlaybookCount > 0 ? "ready" : "watch",
          detail: `${inbox.total} inbox item(s), ${pendingActionCount} pending action(s), ${stalePlaybookCount} stale playbook(s).`,
        },
        {
          mp: "MP119",
          label: "Ops resilience hints",
          status: riskRegister.length > 0 || stalePlaybookCount > 0 ? "ready" : "watch",
          detail: `${riskRegister.length} risk(s), ${stalePlaybookCount} stale playbook(s).`,
        },
      ],
    },
    {
      id: "mp120-mp124",
      range: "MP120-MP124",
      title: "Security and compliance",
      score: clampScore(groundingCoveragePct * 0.35 + feedbackCoveragePct * 0.25 + dataScore(auditTotal, 50) * 0.25 + (pendingActionCount <= doneActionCount ? 15 : 0)),
      summary: "Security posture, permission coverage, audit completeness, policy exceptions, and compliance packet signals.",
      items: [
        {
          mp: "MP120",
          label: "Security posture board",
          status: pendingActionCount <= doneActionCount && auditTotal > 0 ? "ready" : "watch",
          detail: `${auditTotal} audit event(s), ${pendingActionCount}/${doneActionCount} pending/done action balance.`,
        },
        {
          mp: "MP121",
          label: "Permission coverage",
          status: canCt || canOrders ? "ready" : "watch",
          detail: `Scope includes ${canCt ? "Control Tower" : "no Control Tower"} and ${canOrders ? "Orders" : "no Orders"}.`,
        },
        {
          mp: "MP122",
          label: "Audit completeness",
          status: auditTotal > 0 && recentAuditEvents.length > 0 ? "ready" : "watch",
          detail: `${recentAuditEvents.length} recent sample(s), ${auditTotal} total audit event(s).`,
        },
        {
          mp: "MP123",
          label: "Policy exception watch",
          status: riskRegister.length + signalHygieneItems.length > 0 ? "ready" : "watch",
          detail: `${riskRegister.length} risk(s), ${signalHygieneItems.length} hygiene issue(s).`,
        },
        {
          mp: "MP124",
          label: "Compliance packet",
          status: auditTotal > 0 && groundingCoveragePct > 0 ? "ready" : "watch",
          detail: `${groundingCoveragePct}% grounding, ${feedbackCoveragePct}% feedback coverage, ${actionCompletionPct}% action completion.`,
        },
      ],
    },
    {
      id: "mp125-mp129",
      range: "MP125-MP129",
      title: "Admin governance",
      score: clampScore((promptLibraryCandidates.length + templateRecommendations.length + 5) * 8 + rolloutScore * 0.35),
      summary: "Admin-control candidates for configuration, prompt governance, playbook governance, flags, and tenant rollout.",
      items: [
        {
          mp: "MP125",
          label: "Admin configuration map",
          status: surfaceCounts.size + promptLibraryCandidates.length + templateRecommendations.length > 0 ? "ready" : "watch",
          detail: `${surfaceCounts.size} surface(s), ${promptLibraryCandidates.length} prompt candidate(s), ${templateRecommendations.length} playbook template(s).`,
        },
        {
          mp: "MP126",
          label: "Prompt governance map",
          status: promptLibraryCandidates.length > 0 || duplicatePromptCount > 0 ? "ready" : "watch",
          detail: `${promptLibraryCandidates.length} prompt candidate(s), ${duplicatePromptCount} duplicate pattern(s).`,
        },
        {
          mp: "MP127",
          label: "Playbook governance map",
          status: playbookRuns.length > 0 || templateRecommendations.length > 0 ? "ready" : "watch",
          detail: `${playbookRuns.length} run(s), ${templateRecommendations.length} template recommendation(s).`,
        },
        {
          mp: "MP128",
          label: "Feature flag readiness",
          status: rolloutScore >= 60 ? "ready" : "watch",
          detail: `Rollout readiness is ${rolloutScore}/100 (${rolloutLevel}).`,
        },
        {
          mp: "MP129",
          label: "Tenant rollout map",
          status: actorRows.size > 0 && rolloutScore >= 50 ? "ready" : "watch",
          detail: `${actorRows.size} actor row(s), rollout ${rolloutScore}/100.`,
        },
      ],
    },
    {
      id: "mp130-mp134",
      range: "MP130-MP134",
      title: "Evaluation and learning",
      score: clampScore((trainingPositive.length + trainingCorrections.length + promptLibraryCandidates.length) * 8 + feedbackCoveragePct * 0.35),
      summary: "Evaluation candidates, regression watch, benchmark starters, tuning backlog, and quality release gates.",
      items: [
        {
          mp: "MP130",
          label: "Evaluation suite candidates",
          status: trainingPositive.length + trainingCorrections.length > 0 ? "ready" : "watch",
          detail: `${trainingPositive.length} positive example(s), ${trainingCorrections.length} correction example(s).`,
        },
        {
          mp: "MP131",
          label: "Regression watch",
          status: needsReviewCount + confidenceBands.low > 0 ? "ready" : "watch",
          detail: `${needsReviewCount} needs-review answer(s), ${confidenceBands.low} low-confidence answer(s).`,
        },
        {
          mp: "MP132",
          label: "Benchmark starter set",
          status: promptLibraryCandidates.length + answerKindCounts.size > 0 ? "ready" : "watch",
          detail: `${promptLibraryCandidates.length} prompt candidate(s), ${answerKindCounts.size} answer kind(s).`,
        },
        {
          mp: "MP133",
          label: "Tuning backlog",
          status: trainingCorrections.length + signalHygieneItems.length + experimentBacklog.length > 0 ? "ready" : "watch",
          detail: `${trainingCorrections.length} correction(s), ${signalHygieneItems.length} hygiene item(s), ${experimentBacklog.length} experiment(s).`,
        },
        {
          mp: "MP134",
          label: "Quality release gate",
          status: groundingCoveragePct >= 80 && feedbackCoveragePct >= 50 && stalePlaybookCount === 0 ? "ready" : "watch",
          detail: `${groundingCoveragePct}% grounding, ${feedbackCoveragePct}% feedback, ${stalePlaybookCount} stale playbook(s).`,
        },
      ],
    },
    {
      id: "mp135-mp139",
      range: "MP135-MP139",
      title: "Enterprise readiness",
      score: clampScore((rolloutScore + groundingCoveragePct + feedbackCoveragePct + actionCompletionPct + playbookCompletionPct) / 5),
      summary: "Enterprise readiness, scale risk, operating model, executive rollout narrative, and one AI operating-system index.",
      items: [
        {
          mp: "MP135",
          label: "Enterprise readiness board",
          status: rolloutScore >= 70 && groundingCoveragePct >= 80 ? "ready" : "watch",
          detail: `Rollout ${rolloutScore}/100, grounding ${groundingCoveragePct}%, feedback ${feedbackCoveragePct}%.`,
        },
        {
          mp: "MP136",
          label: "Scale risk forecast",
          status: riskRegister.length + handoffQueue.length + ungroundedEvents.length > 0 ? "ready" : "watch",
          detail: `${riskRegister.length} risk(s), ${handoffQueue.length} handoff item(s), ${ungroundedEvents.length} evidence gap(s).`,
        },
        {
          mp: "MP137",
          label: "Operating model map",
          status: "ready",
          detail: `4 cadence item(s), ${handoffQueue.length} handoff item(s).`,
        },
        {
          mp: "MP138",
          label: "Executive rollout narrative",
          status: executiveBriefLines.length > 0 && milestonePlan.length > 0 ? "ready" : "watch",
          detail: `${executiveBriefLines.length} brief line(s), ${milestonePlan.length} milestone(s).`,
        },
        {
          mp: "MP139",
          label: "AI operating system index",
          status: programLayers.length > 0 && maturityLayers.length > 0 ? "ready" : "watch",
          detail: `${programLayers.length} program layer(s), ${maturityLayers.length} maturity layer(s), 10 horizon layer(s).`,
        },
      ],
    },
  ];
  const advancedLayers = [
    {
      id: "mp140-mp144",
      range: "MP140-MP144",
      title: "Digital twin readiness",
      score: clampScore(dataScore(objectCoverageMap.size, 8) * 0.35 + groundingCoveragePct * 0.45 + feedbackCoveragePct * 0.2),
      summary: "Checks whether assistant telemetry can mirror order, shipment, inventory, and confidence signals.",
      items: [
        {
          mp: "MP140",
          label: "Digital twin readiness",
          status: objectCoverageMap.size >= 2 && groundingCoveragePct >= 60 ? "ready" : "watch",
          detail: `${objectCoverageMap.size} object type(s), ${groundingCoveragePct}% grounding coverage.`,
        },
        {
          mp: "MP141",
          label: "Order-flow twin",
          status: hasCoverage("order", "sales") ? "ready" : "watch",
          detail: hasCoverage("order", "sales") ? "Order-flow signals are present." : "No order-flow signal yet.",
        },
        {
          mp: "MP142",
          label: "Shipment-flow twin",
          status: hasCoverage("shipment", "control", "carrier") ? "ready" : "watch",
          detail: hasCoverage("shipment", "control", "carrier") ? "Shipment-flow signals are present." : "No shipment-flow signal yet.",
        },
        {
          mp: "MP143",
          label: "Inventory-flow twin",
          status: hasCoverage("inventory", "product", "stock", "warehouse") ? "ready" : "watch",
          detail: hasCoverage("inventory", "product", "stock", "warehouse") ? "Inventory-flow signals are present." : "No inventory-flow signal yet.",
        },
        {
          mp: "MP144",
          label: "Twin confidence score",
          status: groundingCoveragePct >= 80 && objectlessEvents.length === 0 ? "ready" : "watch",
          detail: `${groundingCoveragePct}% grounded, ${objectlessEvents.length} objectless event(s), ${feedbackCoveragePct}% feedback coverage.`,
        },
      ],
    },
    {
      id: "mp145-mp149",
      range: "MP145-MP149",
      title: "Planning cockpit",
      score: clampScore((recommendations.length + experimentBacklog.length + milestonePlan.length + templateRecommendations.length) * 9 + rolloutScore * 0.25),
      summary: "Converts recommendations, capacity pressure, demand signals, exceptions, and scenarios into planning inputs.",
      items: [
        {
          mp: "MP145",
          label: "Planning cockpit",
          status: recommendations.length + milestonePlan.length > 0 ? "ready" : "watch",
          detail: `${recommendations.length} recommendation(s), ${milestonePlan.length} milestone(s).`,
        },
        {
          mp: "MP146",
          label: "Capacity planning hint",
          status: inbox.total + pendingActionCount + stalePlaybookCount > 0 ? "ready" : "watch",
          detail: `${inbox.total} inbox item(s), ${pendingActionCount} pending action(s), ${stalePlaybookCount} stale playbook(s).`,
        },
        {
          mp: "MP147",
          label: "Demand planning hint",
          status: surfaceCounts.size + duplicatePromptCount > 0 ? "ready" : "watch",
          detail: `${surfaceCounts.size} surface(s), ${duplicatePromptCount} repeated prompt pattern(s).`,
        },
        {
          mp: "MP148",
          label: "Exception planning queue",
          status: riskRegister.length + confidenceBands.low + ungroundedEvents.length > 0 ? "ready" : "watch",
          detail: `${riskRegister.length} risk(s), ${confidenceBands.low} low-confidence answer(s), ${ungroundedEvents.length} evidence gap(s).`,
        },
        {
          mp: "MP149",
          label: "Scenario planning starter",
          status: experimentBacklog.length + templateRecommendations.length > 0 ? "ready" : "watch",
          detail: `${experimentBacklog.length} experiment(s), ${templateRecommendations.length} template recommendation(s).`,
        },
      ],
    },
    {
      id: "mp150-mp154",
      range: "MP150-MP154",
      title: "Network collaboration",
      score: clampScore(dataScore(handoffQueue.length, 8) * 0.35 + dataScore(objectCoverageMap.size, 8) * 0.25 + groundingCoveragePct * 0.4),
      summary: "Groups customer, supplier, carrier, and escalation signals into a network collaboration layer.",
      items: [
        {
          mp: "MP150",
          label: "Network collaboration hub",
          status: hasCoverage("order", "supplier", "shipment", "carrier") || handoffQueue.length > 0 ? "ready" : "watch",
          detail: `${handoffQueue.length} handoff item(s), ${objectCoverageMap.size} object domain(s).`,
        },
        {
          mp: "MP151",
          label: "Customer promise watch",
          status: hasCoverage("customer", "order", "sales") ? "ready" : "watch",
          detail: hasCoverage("customer", "order", "sales") ? "Customer/order promise signals are present." : "No customer promise signal yet.",
        },
        {
          mp: "MP152",
          label: "Supplier promise watch",
          status: hasCoverage("supplier", "srm") ? "ready" : "watch",
          detail: hasCoverage("supplier", "srm") ? "Supplier promise signals are present." : "No supplier promise signal yet.",
        },
        {
          mp: "MP153",
          label: "Carrier promise watch",
          status: hasCoverage("carrier", "shipment", "control") ? "ready" : "watch",
          detail: hasCoverage("carrier", "shipment", "control") ? "Carrier promise signals are present." : "No carrier promise signal yet.",
        },
        {
          mp: "MP154",
          label: "Network escalation map",
          status: handoffQueue.length + riskRegister.length + stalePlaybookCount > 0 ? "ready" : "watch",
          detail: `${handoffQueue.length} handoff item(s), ${riskRegister.length} risk(s), ${stalePlaybookCount} stale playbook(s).`,
        },
      ],
    },
    {
      id: "mp155-mp159",
      range: "MP155-MP159",
      title: "Finance control",
      score: clampScore((hasCoverage("price", "pricing", "tariff", "invoice", "audit") ? 35 : 0) + groundingCoveragePct * 0.35 + actionCompletionPct * 0.3),
      summary: "Finance guardrails for pricing, invoices, disputes, approval chains, and finance-ready packets.",
      items: [
        {
          mp: "MP155",
          label: "Finance control lens",
          status: hasCoverage("price", "pricing", "tariff", "invoice", "audit") || actionCompletionPct > 0 ? "ready" : "watch",
          detail: `${actionCompletionPct}% action completion; finance coverage ${hasCoverage("price", "pricing", "tariff", "invoice", "audit") ? "present" : "not detected"}.`,
        },
        {
          mp: "MP156",
          label: "Revenue leakage watch",
          status: hasCoverage("price", "pricing", "tariff", "invoice", "audit") || confidenceBands.low > 0 ? "ready" : "watch",
          detail: `${confidenceBands.low} low-confidence commercial risk signal(s), ${ungroundedEvents.length} evidence gap(s).`,
        },
        {
          mp: "MP157",
          label: "Dispute readiness",
          status: groundingCoveragePct >= 60 || evidenceNeeded.length > 0 ? "ready" : "watch",
          detail: `${groundingCoveragePct}% grounding coverage, ${evidenceNeeded.length} evidence-needed prompt(s).`,
        },
        {
          mp: "MP158",
          label: "Approval chain map",
          status: pendingActionCount <= doneActionCount ? "ready" : "watch",
          detail: `${pendingActionCount} pending action(s), ${doneActionCount} completed action(s).`,
        },
        {
          mp: "MP159",
          label: "Finance packet",
          status: executiveBriefLines.length > 0 && groundingCoveragePct > 0 ? "ready" : "watch",
          detail: `${executiveBriefLines.length} brief line(s), ${groundingCoveragePct}% evidence coverage.`,
        },
      ],
    },
    {
      id: "mp160-mp164",
      range: "MP160-MP164",
      title: "Sustainability readiness",
      score: clampScore((hasCoverage("shipment", "warehouse", "inventory") ? 30 : 0) + groundingCoveragePct * 0.45 + dataScore(objectCoverageMap.size, 8) * 0.25),
      summary: "Surfaces evidence and logistics data needed for future sustainability and emissions workflows.",
      items: [
        {
          mp: "MP160",
          label: "Sustainability signal board",
          status: objectCoverageMap.size > 0 && groundingCoveragePct > 0 ? "ready" : "watch",
          detail: `${objectCoverageMap.size} object domain(s), ${groundingCoveragePct}% grounding coverage.`,
        },
        {
          mp: "MP161",
          label: "Emissions data readiness",
          status: hasCoverage("shipment", "warehouse", "inventory") && groundingCoveragePct >= 60 ? "ready" : "watch",
          detail: hasCoverage("shipment", "warehouse", "inventory") ? "Operational data signals are present." : "No logistics/inventory data signal yet.",
        },
        {
          mp: "MP162",
          label: "Compliance sustainability watch",
          status: riskRegister.length + evidenceNeeded.length > 0 ? "ready" : "watch",
          detail: `${riskRegister.length} risk(s), ${evidenceNeeded.length} evidence-needed prompt(s).`,
        },
        {
          mp: "MP163",
          label: "Green logistics hint",
          status: hasCoverage("shipment", "carrier", "logistics") ? "ready" : "watch",
          detail: hasCoverage("shipment", "carrier", "logistics") ? "Shipment/logistics signals can support green routing analysis." : "No green-logistics signal yet.",
        },
        {
          mp: "MP164",
          label: "Sustainability reporting starter",
          status: executiveBriefLines.length > 0 ? "ready" : "watch",
          detail: `${executiveBriefLines.length} brief line(s), ${evidenceNeeded.length} evidence-needed item(s).`,
        },
      ],
    },
    {
      id: "mp165-mp169",
      range: "MP165-MP169",
      title: "Resilience control",
      score: clampScore(100 - reviewDebt * 6 - pendingActionAgeBuckets.older * 8 + groundingCoveragePct * 0.2),
      summary: "Combines risk, stale work, disruption pressure, recovery playbooks, continuity, and resilience packets.",
      items: [
        {
          mp: "MP165",
          label: "Resilience control tower",
          status: riskRegister.length + stalePlaybookCount + handoffQueue.length > 0 ? "ready" : "watch",
          detail: `${riskRegister.length} risk(s), ${stalePlaybookCount} stale playbook(s), ${handoffQueue.length} handoff item(s).`,
        },
        {
          mp: "MP166",
          label: "Disruption watch",
          status: pendingActionAgeBuckets.older + stalePlaybookCount + riskRegister.length > 0 ? "ready" : "watch",
          detail: `${pendingActionAgeBuckets.older} aged action(s), ${stalePlaybookCount} stale playbook(s), ${riskRegister.length} risk(s).`,
        },
        {
          mp: "MP167",
          label: "Recovery playbook candidates",
          status: templateRecommendations.length + handoffQueue.length > 0 ? "ready" : "watch",
          detail: `${templateRecommendations.length} template recommendation(s), ${handoffQueue.length} handoff item(s).`,
        },
        {
          mp: "MP168",
          label: "Continuity score",
          status: groundingCoveragePct >= 60 && stalePlaybookCount === 0 ? "ready" : "watch",
          detail: `${groundingCoveragePct}% grounding, ${actionCompletionPct}% action completion, ${stalePlaybookCount} stale playbook(s).`,
        },
        {
          mp: "MP169",
          label: "Resilience packet",
          status: riskRegister.length + milestonePlan.length > 0 ? "ready" : "watch",
          detail: `${riskRegister.length} risk(s), ${milestonePlan.length} milestone(s).`,
        },
      ],
    },
    {
      id: "mp170-mp174",
      range: "MP170-MP174",
      title: "Ecosystem integration",
      score: clampScore(dataScore(surfaceCounts.size, 6) * 0.3 + dataScore(automationCandidates.length, 6) * 0.3 + dataScore(objectCoverageMap.size, 8) * 0.4),
      summary: "Ranks ERP, WMS, TMS, and integration backlog opportunities from current assistant signals.",
      items: [
        {
          mp: "MP170",
          label: "Ecosystem integration map",
          status: surfaceCounts.size + automationCandidates.length + objectCoverageMap.size > 0 ? "ready" : "watch",
          detail: `${surfaceCounts.size} surface(s), ${automationCandidates.length} automation candidate(s), ${objectCoverageMap.size} object domain(s).`,
        },
        {
          mp: "MP171",
          label: "ERP integration readiness",
          status: hasCoverage("order", "invoice", "pricing", "purchase") ? "ready" : "watch",
          detail: hasCoverage("order", "invoice", "pricing", "purchase") ? "ERP-adjacent signals are present." : "No ERP readiness signal yet.",
        },
        {
          mp: "MP172",
          label: "WMS integration readiness",
          status: hasCoverage("warehouse", "wms", "inventory") ? "ready" : "watch",
          detail: hasCoverage("warehouse", "wms", "inventory") ? "WMS-adjacent signals are present." : "No WMS readiness signal yet.",
        },
        {
          mp: "MP173",
          label: "TMS integration readiness",
          status: hasCoverage("shipment", "carrier", "control") ? "ready" : "watch",
          detail: hasCoverage("shipment", "carrier", "control") ? "TMS-adjacent signals are present." : "No TMS readiness signal yet.",
        },
        {
          mp: "MP174",
          label: "Integration backlog",
          status: automationCandidates.length + experimentBacklog.length > 0 ? "ready" : "watch",
          detail: `${automationCandidates.length} automation candidate(s), ${experimentBacklog.length} experiment(s).`,
        },
      ],
    },
    {
      id: "mp175-mp179",
      range: "MP175-MP179",
      title: "Global governance",
      score: clampScore(rolloutScore * 0.35 + feedbackCoveragePct * 0.2 + dataScore(actorRows.size, 10) * 0.25 + dataScore(auditTotal, 50) * 0.2),
      summary: "Prepares rollout, localization, regional risk placeholders, policy packs, and global cadence.",
      items: [
        {
          mp: "MP175",
          label: "Global rollout governance",
          status: rolloutScore >= 60 && actorRows.size > 0 ? "ready" : "watch",
          detail: `Rollout ${rolloutScore}/100, ${actorRows.size} actor row(s).`,
        },
        {
          mp: "MP176",
          label: "Localization readiness",
          status: promptLibraryCandidates.length > 0 && executiveBriefLines.length > 0 ? "ready" : "watch",
          detail: `${promptLibraryCandidates.length} prompt starter(s), ${executiveBriefLines.length} brief line(s).`,
        },
        {
          mp: "MP177",
          label: "Regional risk watch",
          status: objectCoverageMap.size > 0 || handoffQueue.length > 0 ? "ready" : "watch",
          detail: `${objectCoverageMap.size} object domain(s), ${handoffQueue.length} handoff item(s).`,
        },
        {
          mp: "MP178",
          label: "Policy pack readiness",
          status: auditTotal > 0 ? "ready" : "watch",
          detail: `${auditTotal} audit event(s), ${signalHygieneItems.length} hygiene item(s).`,
        },
        {
          mp: "MP179",
          label: "Global operating cadence",
          status: milestonePlan.length > 0 ? "ready" : "watch",
          detail: `${milestonePlan.length} milestone(s), ${handoffQueue.length} handoff item(s).`,
        },
      ],
    },
    {
      id: "mp180-mp184",
      range: "MP180-MP184",
      title: "Copilot experience",
      score: clampScore(dataScore(surfaceCounts.size, 6) * 0.25 + feedbackCoveragePct * 0.25 + groundingCoveragePct * 0.25 + actionCompletionPct * 0.25),
      summary: "Tracks UX surfaces, prompt-to-action funnel, answer quality, action quality, and copilot UX backlog.",
      items: [
        {
          mp: "MP180",
          label: "Copilot experience map",
          status: surfaceCounts.size > 0 ? "ready" : "watch",
          detail: `${surfaceCounts.size} surface(s), primary surface: ${sortedCountRows(surfaceCounts, 1)[0]?.label ?? "none"}.`,
        },
        {
          mp: "MP181",
          label: "Prompt-to-action funnel",
          status: recentAuditEvents.length + pendingActionCount + doneActionCount > 0 ? "ready" : "watch",
          detail: `${recentAuditEvents.length} answer(s), ${pendingActionCount} pending action(s), ${doneActionCount} completed action(s).`,
        },
        {
          mp: "MP182",
          label: "Answer experience quality",
          status: helpfulCount > needsReviewCount && groundingCoveragePct >= 60 ? "ready" : "watch",
          detail: `${helpfulCount} helpful, ${needsReviewCount} needs review, ${groundingCoveragePct}% grounded.`,
        },
        {
          mp: "MP183",
          label: "Action experience quality",
          status: actionCompletionPct >= 50 && pendingActionAgeBuckets.older === 0 ? "ready" : "watch",
          detail: `${actionCompletionPct}% action completion, ${pendingActionAgeBuckets.older} aged action(s).`,
        },
        {
          mp: "MP184",
          label: "Copilot UX backlog",
          status: experimentBacklog.length + signalHygieneItems.length + promptLibraryCandidates.length > 0 ? "ready" : "watch",
          detail: `${experimentBacklog.length} experiment(s), ${signalHygieneItems.length} hygiene item(s), ${promptLibraryCandidates.length} prompt candidate(s).`,
        },
      ],
    },
    {
      id: "mp185-mp189",
      range: "MP185-MP189",
      title: "Autonomous readiness",
      score: clampScore((rolloutScore + groundingCoveragePct + feedbackCoveragePct + actionCompletionPct) / 4 - pendingActionAgeBuckets.older * 5),
      summary: "Keeps next-generation autonomy staged, risk-aware, human-overridable, and tied to the roadmap index.",
      items: [
        {
          mp: "MP185",
          label: "Autonomous readiness index",
          status: rolloutScore >= 70 && groundingCoveragePct >= 80 && pendingActionCount <= doneActionCount ? "ready" : "watch",
          detail: `Rollout ${rolloutScore}/100, grounding ${groundingCoveragePct}%, action balance ${pendingActionCount}/${doneActionCount}.`,
        },
        {
          mp: "MP186",
          label: "Autonomy stage map",
          status: automationCandidates.length > 0 || actionCompletionPct > 0 ? "ready" : "watch",
          detail: `${automationCandidates.length} automation candidate(s), ${actionCompletionPct}% action completion.`,
        },
        {
          mp: "MP187",
          label: "Autonomy risk register",
          status: riskRegister.length + handoffQueue.length + ungroundedEvents.length > 0 ? "ready" : "watch",
          detail: `${riskRegister.length} risk(s), ${handoffQueue.length} handoff item(s), ${ungroundedEvents.length} evidence gap(s).`,
        },
        {
          mp: "MP188",
          label: "Human override posture",
          status: "ready",
          detail: `${pendingActionCount} pending approval(s), ${handoffQueue.length} handoff item(s), ${reviewDebt} review/stale debt item(s).`,
        },
        {
          mp: "MP189",
          label: "Next-generation AI roadmap",
          status: horizonLayers.length > 0 && maturityLayers.length > 0 && programLayers.length > 0 ? "ready" : "watch",
          detail: `${programLayers.length + maturityLayers.length + horizonLayers.length + 10} total roadmap layer group(s) through MP189.`,
        },
      ],
    },
  ];
  const objectCoverageRows = Array.from(objectCoverageMap.values())
    .map((row) => ({
      objectType: row.objectType,
      total: row.auditEvents + row.actions + row.playbooks,
      auditEvents: row.auditEvents,
      actions: row.actions,
      playbooks: row.playbooks,
    }))
    .sort((a, b) => b.total - a.total || a.objectType.localeCompare(b.objectType));
  const reviewDebtCount = needsReviewCount + stalePlaybookCount + feedbackMissingCount;
  const valueScore = clampScore(
    helpfulCount * 8 +
      doneActionCount * 10 +
      completedPlaybookCount * 12 +
      trainingPositive.length * 6 -
      reviewDebtCount * 4,
  );
  const simulationScore = clampScore((rolloutScore + actionCompletionPct + groundingCoveragePct + feedbackCoveragePct) / 4);
  const mp51To80Execution = {
    controlRoom: {
      title: "Governance controls",
      summary: "MP51-MP54: explicit controls for approval, access, sample retention, and audit posture.",
      controls: [
        {
          mp: "MP51",
          label: "Human approval control",
          status: pendingActionCount <= doneActionCount ? "pass" : "watch",
          metric: `${pendingActionCount} pending / ${doneActionCount} done`,
          nextAction: pendingActionCount <= doneActionCount ? "Keep current approval gate." : "Review pending assistant actions.",
          href: "/assistant/command-center",
        },
        {
          mp: "MP52",
          label: "Access posture",
          status: canCt && canOrders ? "pass" : "watch",
          metric: `${canCt ? "Control Tower" : "No Control Tower"} · ${canOrders ? "Orders" : "No Orders"}`,
          nextAction: "Confirm role grants before expanding assistant usage.",
          href: "/assistant/command-center",
        },
        {
          mp: "MP53",
          label: "Retention sample",
          status: recentAuditEvents.length >= 10 ? "pass" : "watch",
          metric: `${recentAuditEvents.length} recent / ${auditTotal} total audit events`,
          nextAction: recentAuditEvents.length >= 10 ? "Use sample for review." : "Collect more real assistant interactions.",
          href: "/assistant/command-center",
        },
        {
          mp: "MP54",
          label: "Approval gate posture",
          status: actionCompletionPct >= 50 || pendingActionCount === 0 ? "pass" : "watch",
          metric: `${actionCompletionPct}% action completion`,
          nextAction: "Close, reject, or complete queued actions before adding automation.",
          href: "/assistant/command-center",
        },
      ],
    },
    valueRealization: {
      title: "Value realization",
      summary: "MP55-MP59: value score, cycle-time drag, workload capacity, deflection, and next value backlog.",
      score: valueScore,
      signals: [
        { mp: "MP55", label: "Value proxy", value: valueScore, detail: `${helpfulCount} helpful answer(s), ${doneActionCount} completed action(s), ${completedPlaybookCount} completed playbook(s).` },
        { mp: "MP56", label: "Cycle-time drag", value: stalePlaybookCount + pendingActionAgeBuckets.older, detail: `${stalePlaybookCount} stale playbook(s), ${pendingActionAgeBuckets.older} action(s) older than seven days.` },
        { mp: "MP57", label: "Capacity load", value: inbox.total + pendingActionCount + reviewDebtCount, detail: `${inbox.total} inbox item(s), ${pendingActionCount} pending action(s), ${reviewDebtCount} review/stale debt item(s).` },
        { mp: "MP58", label: "Deflection candidates", value: trainingPositive.length, detail: `${trainingPositive.length} helpful grounded answer(s) can become self-service examples.` },
        { mp: "MP59", label: "Value backlog", value: experimentBacklog.length + promptLibraryCandidates.length, detail: `${experimentBacklog.length} experiment(s), ${promptLibraryCandidates.length} prompt candidate(s).` },
      ],
      backlog: [
        ...experimentBacklog.slice(0, 4).map((item) => ({
          id: `experiment-${item.id}`,
          title: item.title,
          reason: item.reason,
          priority: item.priority,
        })),
        ...promptLibraryCandidates.slice(0, 3).map((item) => ({
          id: `prompt-${item.id}`,
          title: item.title,
          reason: item.reason,
          priority: "medium",
        })),
      ].slice(0, 6),
    },
    expansionPlanner: {
      title: "Domain expansion planner",
      summary: "MP60-MP64: ranked domains, data dependencies, integration readiness, workflow gaps, and expansion cards.",
      rankedDomains: objectCoverageRows.slice(0, 6).map((row) => ({
        mp: "MP60",
        objectType: row.objectType,
        score: row.total,
        detail: `${row.auditEvents} answer(s), ${row.actions} action(s), ${row.playbooks} playbook(s).`,
      })),
      dependencies: [
        { mp: "MP61", label: "Object context gaps", count: objectlessEvents.length, action: "Improve object inference and embedded entry prompts." },
        { mp: "MP61", label: "Evidence gaps", count: ungroundedEvents.length, action: "Require evidence links before expansion." },
        { mp: "MP62", label: "Surface coverage", count: surfaceCounts.size, action: "Use surface mix to choose the next integration entry point." },
        { mp: "MP63", label: "Workflow template gaps", count: templateRecommendations.length, action: "Convert repeated handoffs into reusable playbooks." },
      ],
      expansionCards: objectCoverageRows.slice(0, 4).map((row) => ({
        mp: "MP64",
        title: `${row.objectType} expansion`,
        reason: `${row.total} recent assistant signal(s) already touch this domain.`,
        nextStep: `Create a guided ${row.objectType} playbook or prompt starter with evidence requirements.`,
      })),
    },
    scaleOps: {
      title: "Scale operations",
      summary: "MP65-MP69: enablement, release train, incident runbook, KPI board, and 30-day roadmap.",
      enablementTargets: Array.from(actorRows.values())
        .map((row) => ({ actorName: row.actorName, total: row.answers + row.actions + row.playbooks }))
        .sort((a, b) => b.total - a.total || a.actorName.localeCompare(b.actorName))
        .slice(0, 5),
      releaseTrain: milestonePlan.map((item) => ({ mp: "MP66", ...item })),
      incidentRunbook: riskRegister.slice(0, 5).map((risk) => ({
        mp: "MP67",
        title: risk.title,
        severity: risk.severity,
        response: risk.mitigation,
      })),
      kpis: [
        { mp: "MP68", label: "Rollout", value: rolloutScore, suffix: "/100" },
        { mp: "MP68", label: "Grounding", value: groundingCoveragePct, suffix: "%" },
        { mp: "MP68", label: "Action completion", value: actionCompletionPct, suffix: "%" },
        { mp: "MP68", label: "Playbook completion", value: playbookCompletionPct, suffix: "%" },
      ],
      roadmap30Day: [
        ...milestonePlan.map((item) => ({ mp: "MP69", horizon: item.horizon, title: item.title, detail: item.detail })),
        {
          mp: "MP69",
          horizon: "Measure",
          title: "Review MP51-MP80 workbench weekly",
          detail: "Use control, value, expansion, scale, process, knowledge, and simulation sections as the operating rhythm.",
        },
      ],
    },
    processIntelligence: {
      title: "Process intelligence",
      summary: "MP70-MP74: process paths, bottlenecks, exception taxonomy, root-cause hints, and recommendation queue.",
      paths: [
        { mp: "MP70", label: "Answer path", count: recentAuditEvents.length, detail: "Assistant questions and answers in the recent sample." },
        { mp: "MP70", label: "Action path", count: recentActions.length, detail: "Queued or completed proposed actions." },
        { mp: "MP70", label: "Playbook path", count: playbookRuns.length, detail: "Reusable workflow runs." },
      ],
      bottlenecks: [
        { mp: "MP71", label: "Needs-review answers", count: needsReviewCount, action: "Review feedback and add corrected examples." },
        { mp: "MP71", label: "Stale playbooks", count: stalePlaybookCount, action: "Complete, refresh, or cancel stale playbooks." },
        { mp: "MP71", label: "Aged actions", count: pendingActionAgeBuckets.older, action: "Close pending actions older than seven days." },
      ],
      exceptions: [
        ...riskRegister.slice(0, 4).map((risk) => ({ mp: "MP72", label: risk.title, count: 1, action: risk.mitigation })),
        { mp: "MP72", label: "Missing evidence", count: ungroundedEvents.length, action: "Attach evidence links or quality metadata." },
      ].slice(0, 5),
      rootCauseHints: [
        objectlessEvents.length > 0
          ? { mp: "MP73", label: "Object inference gap", detail: `${objectlessEvents.length} recent answer(s) lack object context.` }
          : null,
        ungroundedEvents.length > 0
          ? { mp: "MP73", label: "Grounding gap", detail: `${ungroundedEvents.length} recent answer(s) lack grounding.` }
          : null,
        pendingActionCount > doneActionCount
          ? { mp: "MP73", label: "Approval throughput gap", detail: `${pendingActionCount} pending action(s) exceed ${doneActionCount} completed.` }
          : null,
      ].filter((item): item is { mp: string; label: string; detail: string } => Boolean(item)),
      recommendationQueue: [
        ...recommendations.map((item, index) => ({ mp: "MP74", id: `recommendation-${index}`, title: item, priority: "high" })),
        ...experimentBacklog.slice(0, 4).map((item) => ({ mp: "MP74", id: item.id, title: item.title, priority: item.priority })),
      ].slice(0, 6),
    },
    knowledgeSimulation: {
      title: "Knowledge and simulation",
      summary: "MP75-MP80: knowledge candidates, SOP gaps, answer/playbook mappings, evidence packs, freshness, and simulation readiness.",
      knowledgeCandidates: [
        ...trainingPositive.slice(0, 4).map((item) => ({ mp: "MP75", id: item.id, title: item.prompt, detail: `${item.answerKind} · ${item.reason}` })),
        ...promptLibraryCandidates.slice(0, 4).map((item) => ({ mp: "MP75", id: item.id, title: item.title, detail: item.reason })),
      ].slice(0, 6),
      sopGaps: templateRecommendations.slice(0, 5).map((item) => ({
        mp: "MP76",
        title: item.title,
        reason: item.reason,
        priority: item.priority,
      })),
      mappings: sortedCountRows(answerKindCounts, 6).map((row) => ({
        mp: "MP77",
        answerKind: row.label,
        count: row.count,
        suggestedPlaybook: `${row.label} guided review`,
      })),
      evidencePacks: evidenceNeeded.slice(0, 5).map((item) => ({
        mp: "MP78",
        title: item.prompt,
        detail: `${item.answerKind} · ${formatIsoDate(item.createdAt)}`,
      })),
      freshness: {
        mp: "MP79",
        generatedAt: new Date().toISOString(),
        recentSampleSize: recentAuditEvents.length,
        auditTotal,
        status: recentAuditEvents.length > 0 ? "active" : "needs data",
      },
      simulation: {
        mp: "MP80",
        score: simulationScore,
        status: simulationScore >= 70 ? "ready" : "watch",
        checklist: [
          { label: "Rollout readiness at least 60", passed: rolloutScore >= 60 },
          { label: "Grounding coverage at least 70%", passed: groundingCoveragePct >= 70 },
          { label: "Feedback coverage at least 50%", passed: feedbackCoveragePct >= 50 },
          { label: "Action completion at least 50%", passed: actionCompletionPct >= 50 || pendingActionCount === 0 },
        ],
      },
    },
  };
  const shadowScore = clampScore((actionCompletionPct + groundingCoveragePct + feedbackCoveragePct + rolloutScore) / 4);
  const stakeholderScore = clampScore(dataScore(actorRows.size, 8) * 0.3 + dataScore(objectCoverageRows.length, 8) * 0.25 + groundingCoveragePct * 0.45);
  const trustScore = clampScore(groundingCoveragePct * 0.4 + feedbackCoveragePct * 0.35 + dataScore(auditTotal, 50) * 0.25);
  const mp81To110Execution = {
    automationRehearsal: {
      title: "Automation rehearsal",
      summary: "MP81-MP84: keep automation in shadow mode with ranked candidates, rollback checks, and guardrails.",
      shadowMode: {
        mp: "MP81",
        score: shadowScore,
        status: shadowScore >= 70 ? "ready" : "watch",
        detail: `${doneActionCount} completed action(s), ${pendingActionCount} pending action(s), ${actionCompletionPct}% completion.`,
      },
      candidates: automationCandidates.slice(0, 5).map((item) => ({
        mp: "MP82",
        kind: item.kind,
        readinessPct: item.readinessPct,
        recentCount: item.recentCount,
        completedCount: item.completedCount,
        nextStep: item.readinessPct >= 70 ? "Pilot as controlled automation candidate." : "Keep in human-approved shadow mode.",
      })),
      rollbackChecks: [
        { mp: "MP83", label: "Risk register reviewed", passed: riskRegister.length === 0, detail: `${riskRegister.length} risk(s) currently flagged.` },
        { mp: "MP83", label: "Handoff route available", passed: handoffQueue.length > 0 || pendingActionCount === 0, detail: `${handoffQueue.length} handoff item(s).` },
        { mp: "MP83", label: "No aged pending actions", passed: pendingActionAgeBuckets.older === 0, detail: `${pendingActionAgeBuckets.older} action(s) older than seven days.` },
      ],
      guardrails: [
        { mp: "MP84", label: "Human approval remains required", passed: true, detail: "Queued actions are still explicit user-approved work." },
        { mp: "MP84", label: "Grounding target", passed: groundingCoveragePct >= 80, detail: `${groundingCoveragePct}% grounding coverage.` },
        { mp: "MP84", label: "Feedback target", passed: feedbackCoveragePct >= 50, detail: `${feedbackCoveragePct}% feedback coverage.` },
        { mp: "MP84", label: "Stale-work target", passed: stalePlaybookCount === 0, detail: `${stalePlaybookCount} stale playbook(s).` },
      ],
    },
    stakeholderExperience: {
      title: "Stakeholder experience",
      summary: "MP85-MP89: map audiences, communication assets, brief variants, adoption coaching, and board narrative.",
      score: stakeholderScore,
      audiences: [
        { mp: "MP85", label: "Operators", count: inbox.total + pendingActionCount, detail: "Open work and queued actions that need operational follow-up." },
        { mp: "MP85", label: "Leaders", count: executiveBriefLines.length + riskRegister.length, detail: "Brief lines, risks, rollout, and KPI signals." },
        { mp: "MP85", label: "Enablement", count: actorRows.size + promptLibraryCandidates.length, detail: "Adoption rows and prompt starters for coaching." },
      ],
      communicationPack: {
        mp: "MP86",
        lines: executiveBriefLines,
        promptStarterCount: promptLibraryCandidates.length,
        operatingPacketLines: [
          `Rollout: ${rolloutScore}/100 (${rolloutLevel}).`,
          `Quality: ${groundingCoveragePct}% grounding, ${feedbackCoveragePct}% feedback coverage.`,
          `Open work: ${inbox.total} inbox item(s), ${pendingActionCount} pending action(s).`,
        ],
      },
      briefVariants: [
        { mp: "MP87", audience: "Executive", brief: executiveBriefLines.slice(0, 3).join(" ") || "No executive brief data yet." },
        { mp: "MP87", audience: "Operator", brief: `${inbox.total} inbox item(s), ${pendingActionCount} pending action(s), ${stalePlaybookCount} stale playbook(s).` },
        { mp: "MP87", audience: "Enablement", brief: `${promptLibraryCandidates.length} prompt starter(s), ${actorRows.size} adoption row(s), ${trainingPositive.length} positive example(s).` },
      ],
      coachingQueue: Array.from(actorRows.values())
        .map((row) => ({
          mp: "MP88",
          actorName: row.actorName,
          total: row.answers + row.actions + row.playbooks,
          nextStep: promptLibraryCandidates[0]?.prompt ?? "Use the assistant command center to choose a guided prompt.",
        }))
        .sort((a, b) => b.total - a.total || a.actorName.localeCompare(b.actorName))
        .slice(0, 5),
      boardNarrative: {
        mp: "MP89",
        headline: `AI assistant readiness is ${rolloutScore}/100 with ${groundingCoveragePct}% grounding.`,
        points: [
          `${auditTotal} persisted audit event(s) and ${recentAuditEvents.length} recent sample(s).`,
          `${doneActionCount} completed action(s), ${pendingActionCount} pending action(s).`,
          `${riskRegister.length} risk(s) and ${experimentBacklog.length} experiment(s) are visible.`,
        ],
      },
    },
    predictiveTrust: {
      title: "Predictive operations and trust",
      summary: "MP90-MP99: early warnings, delay risk, demand signals, data quality, object links, feedback, grounding, and cleanup.",
      score: trustScore,
      signals: [
        { mp: "MP90", label: "Early-warning signals", value: confidenceBands.low + riskRegister.length + stalePlaybookCount, detail: "Low confidence, risk, and stale work combined." },
        { mp: "MP91", label: "Delay risk", value: pendingActionAgeBuckets.older + stalePlaybookCount, detail: "Aged pending actions plus stale playbooks." },
        { mp: "MP92", label: "Demand signals", value: surfaceCounts.size + duplicatePromptCount + answerKindCounts.size, detail: "Surface mix, repeated prompts, and answer patterns." },
        { mp: "MP93", label: "Exception forecast", value: riskRegister.length + objectlessEvents.length + ungroundedEvents.length, detail: "Risks, object gaps, and evidence gaps." },
        { mp: "MP94", label: "Next-step queue", value: recommendations.length + experimentBacklog.length, detail: "Recommendations and experiments ready to work." },
      ],
      qualityChecks: [
        { mp: "MP95", label: "Signal hygiene", status: signalHygieneItems.length === 0 ? "pass" : "watch", metric: `${signalHygieneItems.length} hygiene item(s).` },
        { mp: "MP96", label: "Object link quality", status: objectlessEvents.length === 0 ? "pass" : "watch", metric: `${objectlessEvents.length} objectless event(s).` },
        { mp: "MP97", label: "Feedback quality", status: feedbackCoveragePct >= 50 ? "pass" : "watch", metric: `${feedbackCoveragePct}% feedback coverage.` },
        { mp: "MP98", label: "Grounding quality", status: groundingCoveragePct >= 80 ? "pass" : "watch", metric: `${groundingCoveragePct}% grounding coverage.` },
        { mp: "MP99", label: "Duplicate cleanup", status: duplicatePromptCount === 0 ? "pass" : "watch", metric: `${duplicatePromptCount} repeated prompt pattern(s).` },
      ],
      cleanupQueue: signalHygieneItems.map((item) => ({
        mp: "MP99",
        label: item.label,
        count: item.count,
        recommendation: item.recommendation,
      })),
    },
    orchestrationAndCollaboration: {
      title: "Orchestration and collaboration",
      summary: "MP100-MP109: agent paths, tools, playbooks, human routing, boundaries, and customer/supplier/carrier collaboration.",
      orchestrationMap: [
        { mp: "MP100", label: "Answer agent", count: recentAuditEvents.length, detail: "Recent persisted assistant answers." },
        { mp: "MP100", label: "Action agent", count: recentActions.length, detail: "Queued and completed action records." },
        { mp: "MP100", label: "Playbook agent", count: playbookRuns.length, detail: "Reusable playbook runs." },
      ],
      toolReadiness: automationCandidates.slice(0, 5).map((item) => ({
        mp: "MP101",
        kind: item.kind,
        readinessPct: item.readinessPct,
        detail: `${item.completedCount} completed of ${item.recentCount} recent action(s).`,
      })),
      playbookHealth: {
        mp: "MP102",
        active: activePlaybookCount,
        completed: completedPlaybookCount,
        stale: stalePlaybookCount,
        templates: templateRecommendations.slice(0, 4),
      },
      humanRouting: handoffQueue.slice(0, 6).map((item) => ({
        mp: "MP103",
        title: item.title,
        type: item.type,
        ownerHint: item.ownerHint,
        href: item.href,
      })),
      boundaries: [
        { mp: "MP104", label: "Low confidence", count: confidenceBands.low, detail: "Answers that should stay human-reviewed." },
        { mp: "MP104", label: "Missing grounding", count: ungroundedEvents.length, detail: "Answers that need evidence before reuse." },
        { mp: "MP104", label: "Pending approval", count: pendingActionCount, detail: "Actions waiting for a human decision." },
      ],
      collaborationLenses: [
        { mp: "MP105", label: "Customer", ready: hasCoverage("customer", "sales", "order", "mail"), detail: "Sales-order, customer, and mail-context coverage." },
        { mp: "MP106", label: "Supplier", ready: hasCoverage("supplier", "srm"), detail: "Supplier and SRM object coverage." },
        { mp: "MP107", label: "Carrier", ready: hasCoverage("shipment", "carrier", "control"), detail: "Shipment, carrier, and Control Tower coverage." },
        { mp: "MP108", label: "Collaboration packet", ready: executiveBriefLines.length > 0, detail: `${executiveBriefLines.length} brief line(s) available.` },
        { mp: "MP109", label: "Collaboration risk", ready: riskRegister.length + ungroundedEvents.length + stalePlaybookCount > 0, detail: `${riskRegister.length} risk(s), ${ungroundedEvents.length} evidence gap(s), ${stalePlaybookCount} stale playbook(s).` },
      ],
    },
    commercialImpact: {
      title: "Commercial impact",
      summary: "MP110: commercial value lens tying helpful answers, completed actions, automation candidates, and risk signals together.",
      score: clampScore(helpfulCount * 8 + doneActionCount * 10 + automationCandidates.length * 6 - reviewDebtCount * 3),
      signals: [
        { mp: "MP110", label: "Helpful answers", value: helpfulCount, detail: "User-marked helpful assistant answers." },
        { mp: "MP110", label: "Completed actions", value: doneActionCount, detail: "Human-approved actions marked done." },
        { mp: "MP110", label: "Automation candidates", value: automationCandidates.length, detail: "Action kinds with completion history." },
        { mp: "MP110", label: "Commercial risk signals", value: confidenceBands.low + ungroundedEvents.length + riskRegister.length, detail: "Low-confidence, ungrounded, or risk-register items." },
      ],
      nextActions: [
        helpfulCount > 0 ? "Convert helpful commercial answers into prompt starters." : "Collect helpful feedback on commercial answers.",
        doneActionCount > 0 ? "Review completed action kinds for controlled automation." : "Complete or reject pending assistant actions.",
        confidenceBands.low + ungroundedEvents.length > 0 ? "Add evidence to weak commercial answers before reuse." : "Keep monitoring commercial answer quality.",
      ],
    },
  };

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
    slaPosture: {
      status: slaStatus,
      actionCompletionPct,
      playbookCompletionPct,
      openInboxCount: inbox.total,
      stalePlaybookCount,
      oldestPendingActionDays: pendingActions.length
        ? Math.max(...pendingActions.map((item) => ageDays(item.createdAt)))
        : 0,
    },
    trainingQueue: {
      positive: trainingPositive,
      corrections: trainingCorrections,
    },
    promptLibrary: {
      candidates: promptLibraryCandidates,
    },
    decisionJournal: {
      events: decisionJournal,
    },
    signalHygiene: {
      items: signalHygieneItems,
    },
    programLayers,
    maturityLayers,
    horizonLayers,
    advancedLayers,
    mp51To80Execution,
    mp81To110Execution,
  });
}
