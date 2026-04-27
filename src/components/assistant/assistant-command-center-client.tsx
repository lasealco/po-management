"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import type { AssistantInboxItem, AssistantInboxPayload } from "@/lib/assistant/inbox-aggregate";

type QualitySummary = {
  auditTotal: number;
  feedback: { helpful: number; needsReview: number; missing: number };
  recentSampleSize: number;
  groundingCoveragePct: number;
  needsReview: Array<{
    id: string;
    prompt: string;
    answerKind: string;
    message: string | null;
    objectType: string | null;
    objectId: string | null;
    createdAt: string;
    actorName: string;
  }>;
};

type QueuedAction = {
  id: string;
  actionKind: string;
  label: string;
  description: string | null;
  status: string;
  href: string | null;
  objectType: string | null;
  objectId: string | null;
  createdAt: string;
  actorName: string;
};

type PlaybookRun = {
  id: string;
  playbookId: string;
  title: string;
  status: string;
  objectType: string | null;
  objectId: string | null;
  updatedAt: string;
  actorName: string;
};

type MemoryEvent = {
  id: string;
  prompt: string;
  answerKind: string;
  message: string | null;
  feedback: string | null;
  objectType: string | null;
  objectId: string | null;
  createdAt: string;
  actorName: string;
};

type PriorityLane = {
  id: string;
  label: string;
  count: number;
  items: Array<{ id: string; label: string; reason: string; href: string | null }>;
};

type ReviewQueueItem = {
  id: string;
  label: string;
  reason: string;
  createdAt?: string;
  updatedAt?: string;
  actorName?: string;
};

type ConfidenceItem = {
  id: string;
  prompt: string;
  answerKind: string;
  confidence: string;
  score: number;
  reason: string;
  createdAt: string;
};

type GapItem = {
  id: string;
  label: string;
  reason: string;
  createdAt: string;
};

type CommandCenterPayload = {
  generatedAt: string;
  inbox: Pick<AssistantInboxPayload, "total" | "producers"> & { items: AssistantInboxItem[] };
  quality: QualitySummary;
  actionQueue: { pendingCount: number; doneCount: number; items: QueuedAction[] };
  playbooks: { activeCount: number; completedCount: number; staleCount: number; runs: PlaybookRun[] };
  memory: { recentEvents: MemoryEvent[] };
  health: {
    auditTotal: number;
    openInboxCount: number;
    pendingActionCount: number;
    activePlaybookCount: number;
    stalePlaybookCount: number;
    needsReviewCount: number;
    groundingCoveragePct: number;
    recommendations: string[];
  };
  priority: { lanes: PriorityLane[] };
  coverage: {
    objectTypes: Array<{ objectType: string; auditEvents: number; actions: number; playbooks: number }>;
  };
  automation: {
    pendingCount: number;
    doneCount: number;
    completionPct: number;
    candidates: Array<{ kind: string; recentCount: number; completedCount: number; readinessPct: number }>;
  };
  reviewQueue: {
    total: number;
    needsReviewAnswers: ReviewQueueItem[];
    stalePlaybooks: ReviewQueueItem[];
    unreviewedMemory: ReviewQueueItem[];
  };
  brief: { text: string; lines: string[] };
  confidence: {
    bands: { high: number; medium: number; low: number };
    sampleSize: number;
    lowConfidence: ConfidenceItem[];
  };
  domainGaps: {
    objectlessCount: number;
    ungroundedCount: number;
    unknownDomainCount: number;
    examples: GapItem[];
  };
  escalationWatch: {
    pendingActionAgeBuckets: { today: number; threeDays: number; sevenDays: number; older: number };
    oldestPendingActions: Array<{
      id: string;
      label: string;
      ageDays: number;
      objectType: string | null;
      objectId: string | null;
      href: string | null;
      actorName: string;
    }>;
    stalePlaybooks: Array<{
      id: string;
      label: string;
      ageDays: number;
      objectType: string | null;
      objectId: string | null;
      actorName: string;
    }>;
  };
  playbookRecommendations: {
    templates: Array<{ id: string; title: string; reason: string; priority: string }>;
  };
  rollout: {
    score: number;
    level: string;
    checklist: Array<{ id: string; label: string; passed: boolean }>;
  };
  adoption: {
    actors: Array<{ actorName: string; answers: number; actions: number; playbooks: number; total: number }>;
  };
  surfaceMix: {
    surfaces: Array<{ label: string; count: number }>;
    primarySurface: string;
  };
  scenarioCoverage: {
    answerKinds: Array<{ label: string; count: number }>;
    objectTypes: Array<{
      label: string;
      count: number;
      auditEvents: number;
      actions: number;
      playbooks: number;
    }>;
  };
  experiments: {
    backlog: Array<{ id: string; title: string; reason: string; priority: string }>;
  };
  operatingCadence: {
    today: { answers: number; actions: number; playbooks: number };
    checklist: Array<{ id: string; label: string; count: number; href: string }>;
    nextStep: string;
  };
  operatingPacket: { text: string; lines: string[] };
  riskRegister: {
    risks: Array<{ id: string; severity: string; title: string; signal: string; mitigation: string }>;
  };
  handoff: {
    items: Array<{ id: string; type: string; title: string; detail: string; href: string | null; ownerHint: string }>;
  };
  evidenceLedger: {
    groundedCount: number;
    ungroundedCount: number;
    coveragePct: number;
    evidenceNeeded: Array<{ id: string; prompt: string; answerKind: string; createdAt: string }>;
  };
  milestonePlan: {
    milestones: Array<{ horizon: string; title: string; detail: string }>;
  };
};

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function metricCard(label: string, value: string | number, helper: string, tone = "border-zinc-200 bg-white") {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-950">{value}</p>
      <p className="mt-1 text-xs text-zinc-600">{helper}</p>
    </div>
  );
}

function objectLabel(type: string | null, id: string | null) {
  if (!type && !id) return "No object context";
  return [type, id?.slice(0, 10)].filter(Boolean).join(" · ");
}

export function AssistantCommandCenterClient() {
  const [data, setData] = useState<CommandCenterPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [copiedPacket, setCopiedPacket] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/assistant/command-center");
      const parsed: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(apiClientErrorMessage(parsed, "Could not load assistant command center."));
        return;
      }
      setData(parsed as CommandCenterPayload);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load assistant command center.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (busy && !data) return <p className="text-sm text-zinc-600">Loading assistant command center...</p>;

  if (!data) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        {err ? <p className="text-sm text-red-700">{err}</p> : <p className="text-sm text-zinc-600">No data yet.</p>}
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const inboxItems = data.inbox.items;
  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(data.brief.text);
      setCopiedBrief(true);
      window.setTimeout(() => setCopiedBrief(false), 1600);
    } catch {
      setErr("Could not copy brief to clipboard.");
    }
  };
  const copyPacket = async () => {
    try {
      await navigator.clipboard.writeText(data.operatingPacket.text);
      setCopiedPacket(true);
      window.setTimeout(() => setCopiedPacket(false), 1600);
    } catch {
      setErr("Could not copy operating packet to clipboard.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">MP20-MP44</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">Assistant command center</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              One operating view for cross-workspace work, feedback quality, queued actions, active playbooks, recent
              memory, assistant health, priority lanes, review queues, automation readiness, rollout confidence,
              adoption, experiments, daily cadence, handoff, evidence, and milestone planning.
            </p>
            <p className="mt-2 text-xs text-zinc-500">Generated {formatDate(data.generatedAt)}</p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load()}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {busy ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {err ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p> : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metricCard("Open work", data.health.openInboxCount, "Inbox items across CT, mail, and draft SOs", "border-amber-200 bg-amber-50")}
        {metricCard("Audit events", data.health.auditTotal, "Persisted assistant answers")}
        {metricCard("Grounding", `${data.health.groundingCoveragePct}%`, "Recent answers with quality/evidence")}
        {metricCard("Action queue", data.health.pendingActionCount, "Pending user-approved actions", "border-sky-200 bg-sky-50")}
        {metricCard("Active playbooks", data.health.activePlaybookCount, `${data.health.stalePlaybookCount} stale`)}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-950">Operating packet</h3>
              <p className="mt-1 text-sm text-zinc-600">MP40 copy-ready standup/update packet.</p>
            </div>
            <button
              type="button"
              onClick={() => void copyPacket()}
              className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              {copiedPacket ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
            {data.operatingPacket.lines.map((line, index) => (
              <p key={line} className={index === 0 ? "" : "mt-2"}>
                {line}
              </p>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Risk register</h3>
          <p className="mt-1 text-sm text-zinc-600">MP41 explicit risks and mitigation steps for assistant operations.</p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {data.riskRegister.risks.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
                No assistant operating risks flagged.
              </p>
            ) : (
              data.riskRegister.risks.slice(0, 4).map((risk) => (
                <div key={risk.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900">{risk.title}</p>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                      {risk.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{risk.signal}</p>
                  <p className="mt-2 text-xs text-zinc-700">{risk.mitigation}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Handoff queue</h3>
          <p className="mt-1 text-sm text-zinc-600">MP42 human take-next work across actions, inbox, and review.</p>
          <div className="mt-4 space-y-2">
            {data.handoff.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No handoff work queued.</p>
            ) : (
              data.handoff.items.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{item.type}</p>
                  <p className="mt-1 font-semibold text-zinc-900">{item.title}</p>
                  <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-500">{item.ownerHint}</span>
                    {item.href ? (
                      <Link href={item.href} className="text-xs font-semibold text-[var(--arscmp-primary)] hover:underline">
                        Open
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Evidence ledger</h3>
          <p className="mt-1 text-sm text-zinc-600">MP43 grounding coverage and evidence debt.</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-950">
              <p className="text-xl font-semibold">{data.evidenceLedger.groundedCount}</p>
              <p className="text-xs">Grounded</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-rose-950">
              <p className="text-xl font-semibold">{data.evidenceLedger.ungroundedCount}</p>
              <p className="text-xs">Needs evidence</p>
            </div>
            <div className="rounded-xl bg-sky-50 p-3 text-sky-950">
              <p className="text-xl font-semibold">{data.evidenceLedger.coveragePct}%</p>
              <p className="text-xs">Coverage</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {data.evidenceLedger.evidenceNeeded.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No evidence debt in the recent sample.</p>
            ) : (
              data.evidenceLedger.evidenceNeeded.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <p className="font-semibold text-zinc-900">{item.prompt}</p>
                  <p className="mt-1 text-xs text-zinc-600">{item.answerKind} · {formatDate(item.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Milestone plan</h3>
          <p className="mt-1 text-sm text-zinc-600">MP44 signal-driven Now / Next / Later plan.</p>
          <div className="mt-4 space-y-2">
            {data.milestonePlan.milestones.map((item) => (
              <div key={item.horizon} className="rounded-xl border border-zinc-200 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{item.horizon}</p>
                <p className="mt-1 font-semibold text-zinc-900">{item.title}</p>
                <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Daily operating cadence</h3>
          <p className="mt-1 text-sm text-zinc-600">MP39 today’s rhythm for running the assistant layer.</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-zinc-100 p-3">
              <p className="text-xl font-semibold">{data.operatingCadence.today.answers}</p>
              <p className="text-xs text-zinc-600">Answers</p>
            </div>
            <div className="rounded-xl bg-zinc-100 p-3">
              <p className="text-xl font-semibold">{data.operatingCadence.today.actions}</p>
              <p className="text-xs text-zinc-600">Actions</p>
            </div>
            <div className="rounded-xl bg-zinc-100 p-3">
              <p className="text-xl font-semibold">{data.operatingCadence.today.playbooks}</p>
              <p className="text-xs text-zinc-600">Playbooks</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {data.operatingCadence.checklist.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 text-sm hover:bg-zinc-50"
              >
                <span className="font-medium text-zinc-900">{item.label}</span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{item.count}</span>
              </Link>
            ))}
          </div>
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Next step: {data.operatingCadence.nextStep}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Experiment backlog</h3>
          <p className="mt-1 text-sm text-zinc-600">MP38 ranked improvements from gaps, templates, and action history.</p>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {data.experiments.backlog.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
                No experiment candidates right now.
              </p>
            ) : (
              data.experiments.backlog.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900">{item.title}</p>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{item.priority}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{item.reason}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Adoption heatmap</h3>
          <p className="mt-1 text-sm text-zinc-600">MP35 assistant usage by actor.</p>
          <div className="mt-4 space-y-2">
            {data.adoption.actors.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No actor activity yet.</p>
            ) : (
              data.adoption.actors.slice(0, 5).map((actor) => (
                <div key={actor.actorName} className="rounded-xl border border-zinc-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-900">{actor.actorName}</p>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{actor.total}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">
                    {actor.answers} answer(s) · {actor.actions} action(s) · {actor.playbooks} playbook(s)
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Surface mix</h3>
          <p className="mt-1 text-sm text-zinc-600">MP36 where assistant usage enters the workflow.</p>
          <p className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-950">
            Primary surface: <span className="font-semibold">{data.surfaceMix.primarySurface}</span>
          </p>
          <div className="mt-3 space-y-2">
            {data.surfaceMix.surfaces.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No surface data yet.</p>
            ) : (
              data.surfaceMix.surfaces.map((surface) => (
                <div key={surface.label} className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-sm">
                  <span className="font-medium text-zinc-900">{surface.label}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{surface.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Scenario coverage</h3>
          <p className="mt-1 text-sm text-zinc-600">MP37 answer patterns and object coverage.</p>
          <div className="mt-4 space-y-2">
            {data.scenarioCoverage.answerKinds.slice(0, 3).map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-sm">
                <span className="font-medium text-zinc-900">{row.label}</span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{row.count}</span>
              </div>
            ))}
            {data.scenarioCoverage.objectTypes.slice(0, 3).map((row) => (
              <div key={row.label} className="rounded-xl border border-zinc-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-zinc-900">{row.label}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{row.count}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  {row.auditEvents} answer(s) · {row.actions} action(s) · {row.playbooks} playbook(s)
                </p>
              </div>
            ))}
            {data.scenarioCoverage.answerKinds.length === 0 && data.scenarioCoverage.objectTypes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No scenarios covered yet.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Rollout readiness</h3>
          <p className="mt-1 text-sm text-zinc-600">MP34 go/no-go score for expanding assistant usage.</p>
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-4xl font-semibold text-emerald-950">{data.rollout.score}</p>
            <p className="mt-1 text-sm font-medium text-emerald-900">{data.rollout.level}</p>
          </div>
          <div className="mt-4 space-y-2">
            {data.rollout.checklist.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-3 text-sm ${
                  item.passed ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"
                }`}
              >
                <span className="font-semibold">{item.passed ? "Passed" : "Watch"}:</span> {item.label}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Confidence bands</h3>
          <p className="mt-1 text-sm text-zinc-600">MP30 trust bands for recent persisted assistant answers.</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-950">
              <p className="text-2xl font-semibold">{data.confidence.bands.high}</p>
              <p className="text-xs">High</p>
            </div>
            <div className="rounded-xl bg-sky-50 p-3 text-sky-950">
              <p className="text-2xl font-semibold">{data.confidence.bands.medium}</p>
              <p className="text-xs">Medium</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-rose-950">
              <p className="text-2xl font-semibold">{data.confidence.bands.low}</p>
              <p className="text-xs">Low</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {data.confidence.lowConfidence.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
                No low-confidence answers in the recent sample.
              </p>
            ) : (
              data.confidence.lowConfidence.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-rose-950">{item.prompt}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-rose-800">{item.score}</span>
                  </div>
                  <p className="mt-1 text-xs text-rose-800">{item.reason}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Priority lanes</h3>
          <p className="mt-1 text-sm text-zinc-600">MP25 ranking for urgent, active, and follow-up assistant work.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {data.priority.lanes.map((lane) => (
              <div key={lane.id} className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-900">{lane.label}</p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-zinc-700">{lane.count}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {lane.items.length === 0 ? (
                    <p className="text-xs text-zinc-500">No work in this lane.</p>
                  ) : (
                    lane.items.slice(0, 3).map((item) => (
                      <div key={item.id} className="rounded-lg bg-white p-2 text-xs">
                        <p className="font-semibold text-zinc-900">{item.label}</p>
                        <p className="mt-1 text-zinc-600">{item.reason}</p>
                        {item.href ? (
                          <Link href={item.href} className="mt-2 inline-flex font-semibold text-[var(--arscmp-primary)] hover:underline">
                            Open
                          </Link>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-950">Executive brief</h3>
              <p className="mt-1 text-sm text-zinc-600">MP29 copy-ready assistant ops summary.</p>
            </div>
            <button
              type="button"
              onClick={() => void copyBrief()}
              className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              {copiedBrief ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
            {data.brief.lines.map((line, index) => (
              <p key={line} className={index === 0 ? "" : "mt-2"}>
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Domain-gap radar</h3>
          <p className="mt-1 text-sm text-zinc-600">MP31 missing object context and grounding coverage gaps.</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-zinc-100 p-3">
              <p className="text-xl font-semibold">{data.domainGaps.objectlessCount}</p>
              <p className="text-xs text-zinc-600">Objectless</p>
            </div>
            <div className="rounded-xl bg-zinc-100 p-3">
              <p className="text-xl font-semibold">{data.domainGaps.ungroundedCount}</p>
              <p className="text-xs text-zinc-600">Ungrounded</p>
            </div>
            <div className="rounded-xl bg-zinc-100 p-3">
              <p className="text-xl font-semibold">{data.domainGaps.unknownDomainCount}</p>
              <p className="text-xs text-zinc-600">Unknown</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {data.domainGaps.examples.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No domain gaps detected.</p>
            ) : (
              data.domainGaps.examples.slice(0, 4).map((item) => (
                <div key={`${item.reason}-${item.id}`} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <p className="font-semibold text-zinc-900">{item.label}</p>
                  <p className="mt-1 text-xs text-zinc-600">{item.reason} · {formatDate(item.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Escalation watch</h3>
          <p className="mt-1 text-sm text-zinc-600">MP32 aged pending actions and stale playbooks.</p>
          <div className="mt-4 grid grid-cols-4 gap-1 text-center text-xs">
            <div className="rounded-lg bg-zinc-100 p-2">
              <p className="font-semibold">{data.escalationWatch.pendingActionAgeBuckets.today}</p>
              <p>0-1d</p>
            </div>
            <div className="rounded-lg bg-zinc-100 p-2">
              <p className="font-semibold">{data.escalationWatch.pendingActionAgeBuckets.threeDays}</p>
              <p>2-3d</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-950">
              <p className="font-semibold">{data.escalationWatch.pendingActionAgeBuckets.sevenDays}</p>
              <p>4-7d</p>
            </div>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-950">
              <p className="font-semibold">{data.escalationWatch.pendingActionAgeBuckets.older}</p>
              <p>7d+</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {[...data.escalationWatch.oldestPendingActions, ...data.escalationWatch.stalePlaybooks].slice(0, 5).length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No aged assistant work.</p>
            ) : (
              [...data.escalationWatch.oldestPendingActions, ...data.escalationWatch.stalePlaybooks].slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <p className="font-semibold text-zinc-900">{item.label}</p>
                  <p className="mt-1 text-xs text-zinc-600">{item.ageDays} day(s) old · {objectLabel(item.objectType, item.objectId)}</p>
                  {"href" in item && item.href ? (
                    <Link href={item.href} className="mt-2 inline-flex text-xs font-semibold text-[var(--arscmp-primary)] hover:underline">
                      Open target
                    </Link>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Playbook templates</h3>
          <p className="mt-1 text-sm text-zinc-600">MP33 candidates for reusable guided workflows.</p>
          <div className="mt-4 space-y-2">
            {data.playbookRecommendations.templates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
                No repeated pattern strong enough yet.
              </p>
            ) : (
              data.playbookRecommendations.templates.map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900">{item.title}</p>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{item.priority}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{item.reason}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-950">Cross-workspace work</h3>
              <p className="mt-1 text-sm text-zinc-600">MP20 command list from the assistant inbox.</p>
            </div>
            <Link href="/assistant/inbox" className="text-sm font-semibold text-[var(--arscmp-primary)] hover:underline">
              Open inbox
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {inboxItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No open inbox work.</p>
            ) : (
              inboxItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{item.kind.replace("_", " ")}</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">{item.title}</p>
                  {item.subtitle ? <p className="mt-1 text-xs text-zinc-600">{item.subtitle}</p> : null}
                  {item.suggestedAction ? <p className="mt-2 text-xs text-zinc-700">{item.suggestedAction.label}</p> : null}
                  <Link href={item.href} className="mt-3 inline-flex text-sm font-semibold text-[var(--arscmp-primary)] hover:underline">
                    Open work
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Quality signals</h3>
          <p className="mt-1 text-sm text-zinc-600">MP21 feedback and grounding snapshot.</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-950">
              <p className="text-xl font-semibold">{data.quality.feedback.helpful}</p>
              <p className="text-xs">Helpful</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-rose-950">
              <p className="text-xl font-semibold">{data.quality.feedback.needsReview}</p>
              <p className="text-xs">Needs review</p>
            </div>
            <div className="rounded-xl bg-zinc-100 p-3 text-zinc-800">
              <p className="text-xl font-semibold">{data.quality.feedback.missing}</p>
              <p className="text-xs">No feedback</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {data.quality.needsReview.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
                No Needs review answers yet.
              </p>
            ) : (
              data.quality.needsReview.map((event) => (
                <div key={event.id} className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-sm">
                  <p className="font-medium text-rose-950">{event.prompt}</p>
                  <p className="mt-1 text-xs text-rose-800">{objectLabel(event.objectType, event.objectId)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Object coverage</h3>
          <p className="mt-1 text-sm text-zinc-600">MP26 assistant activity grouped by object type.</p>
          <div className="mt-4 space-y-2">
            {data.coverage.objectTypes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No object coverage yet.</p>
            ) : (
              data.coverage.objectTypes.slice(0, 6).map((row) => (
                <div key={row.objectType} className="rounded-xl border border-zinc-200 p-3">
                  <p className="text-sm font-semibold text-zinc-900">{row.objectType}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {row.auditEvents} answer(s) · {row.actions} action(s) · {row.playbooks} playbook(s)
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Automation readiness</h3>
          <p className="mt-1 text-sm text-zinc-600">MP27 safe automation candidates from user-approved action history.</p>
          <div className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-950">
            <p className="text-2xl font-semibold">{data.automation.completionPct}%</p>
            <p className="text-xs">Done rate across pending + completed actions</p>
          </div>
          <div className="mt-3 space-y-2">
            {data.automation.candidates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No action history yet.</p>
            ) : (
              data.automation.candidates.map((candidate) => (
                <div key={candidate.kind} className="rounded-xl border border-zinc-200 p-3">
                  <p className="text-sm font-semibold text-zinc-900">{candidate.kind}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {candidate.completedCount}/{candidate.recentCount} done · {candidate.readinessPct}% readiness
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Review queue</h3>
          <p className="mt-1 text-sm text-zinc-600">MP28 weak answers, stale playbooks, and unreviewed memory.</p>
          <div className="mt-4 space-y-2">
            {[
              ...data.reviewQueue.needsReviewAnswers,
              ...data.reviewQueue.stalePlaybooks,
              ...data.reviewQueue.unreviewedMemory,
            ].slice(0, 7).length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No review work queued.</p>
            ) : (
              [
                ...data.reviewQueue.needsReviewAnswers,
                ...data.reviewQueue.stalePlaybooks,
                ...data.reviewQueue.unreviewedMemory,
              ]
                .slice(0, 7)
                .map((item) => (
                  <div key={`${item.reason}-${item.id}`} className="rounded-xl border border-zinc-200 p-3">
                    <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                    <p className="mt-1 text-xs text-zinc-600">{item.reason}</p>
                    {item.createdAt || item.updatedAt ? (
                      <p className="mt-1 text-xs text-zinc-500">{formatDate(item.createdAt ?? item.updatedAt!)}</p>
                    ) : null}
                  </div>
                ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Action queue</h3>
          <p className="mt-1 text-sm text-zinc-600">MP22 triage for user-approved assistant actions.</p>
          <div className="mt-4 space-y-2">
            {data.actionQueue.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No pending actions.</p>
            ) : (
              data.actionQueue.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-200 p-3">
                  <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                  {item.description ? <p className="mt-1 text-xs text-zinc-600">{item.description}</p> : null}
                  <p className="mt-2 text-xs text-zinc-500">
                    {item.status} · {objectLabel(item.objectType, item.objectId)} · {formatDate(item.createdAt)}
                  </p>
                  {item.href ? (
                    <Link href={item.href} className="mt-3 inline-flex text-sm font-semibold text-[var(--arscmp-primary)] hover:underline">
                      Open target
                    </Link>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Playbook operations</h3>
          <p className="mt-1 text-sm text-zinc-600">MP23 active and recently completed guided workflows.</p>
          <div className="mt-4 space-y-2">
            {data.playbooks.runs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No playbook runs yet.</p>
            ) : (
              data.playbooks.runs.map((run) => (
                <div key={run.id} className="rounded-xl border border-zinc-200 p-3">
                  <p className="text-sm font-semibold text-zinc-900">{run.title}</p>
                  <p className="mt-1 text-xs text-zinc-600">{run.playbookId}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {run.status} · {objectLabel(run.objectType, run.objectId)} · updated {formatDate(run.updatedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Ops health</h3>
          <p className="mt-1 text-sm text-zinc-600">MP24 recommendation snapshot.</p>
          <div className="mt-4 space-y-2">
            {data.health.recommendations.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
                Assistant health looks clean.
              </p>
            ) : (
              data.health.recommendations.map((rec) => (
                <p key={rec} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  {rec}
                </p>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Recent assistant memory</h3>
          <p className="mt-1 text-sm text-zinc-600">Latest persisted answers across object workspaces.</p>
          <div className="mt-4 space-y-2">
            {data.memory.recentEvents.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
                No assistant audit events yet.
              </p>
            ) : (
              data.memory.recentEvents.map((event) => (
                <div key={event.id} className="rounded-xl border border-zinc-200 p-3">
                  <p className="text-sm font-semibold text-zinc-900">{event.prompt}</p>
                  {event.message ? <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{event.message}</p> : null}
                  <p className="mt-2 text-xs text-zinc-500">
                    {event.answerKind} · {event.feedback ?? "no feedback"} · {objectLabel(event.objectType, event.objectId)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
