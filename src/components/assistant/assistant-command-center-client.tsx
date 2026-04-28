"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import type { AssistantInboxItem, AssistantInboxPayload } from "@/lib/assistant/inbox-aggregate";

type CommandCenterLayer = {
  id: string;
  range: string;
  title: string;
  score: number;
  summary: string;
  items: Array<{ mp: string; label: string; status: string; detail: string }>;
};

type Mp51To80Execution = {
  controlRoom: {
    title: string;
    summary: string;
    controls: Array<{ mp: string; label: string; status: string; metric: string; nextAction: string; href: string }>;
  };
  valueRealization: {
    title: string;
    summary: string;
    score: number;
    signals: Array<{ mp: string; label: string; value: number; detail: string }>;
    backlog: Array<{ id: string; title: string; reason: string; priority: string }>;
  };
  expansionPlanner: {
    title: string;
    summary: string;
    rankedDomains: Array<{ mp: string; objectType: string; score: number; detail: string }>;
    dependencies: Array<{ mp: string; label: string; count: number; action: string }>;
    expansionCards: Array<{ mp: string; title: string; reason: string; nextStep: string }>;
  };
  scaleOps: {
    title: string;
    summary: string;
    enablementTargets: Array<{ actorName: string; total: number }>;
    releaseTrain: Array<{ mp: string; horizon: string; title: string; detail: string }>;
    incidentRunbook: Array<{ mp: string; title: string; severity: string; response: string }>;
    kpis: Array<{ mp: string; label: string; value: number; suffix: string }>;
    roadmap30Day: Array<{ mp: string; horizon: string; title: string; detail: string }>;
  };
  processIntelligence: {
    title: string;
    summary: string;
    paths: Array<{ mp: string; label: string; count: number; detail: string }>;
    bottlenecks: Array<{ mp: string; label: string; count: number; action: string }>;
    exceptions: Array<{ mp: string; label: string; count: number; action: string }>;
    rootCauseHints: Array<{ mp: string; label: string; detail: string }>;
    recommendationQueue: Array<{ mp: string; id: string; title: string; priority: string }>;
  };
  knowledgeSimulation: {
    title: string;
    summary: string;
    knowledgeCandidates: Array<{ mp: string; id: string; title: string; detail: string }>;
    sopGaps: Array<{ mp: string; title: string; reason: string; priority: string }>;
    mappings: Array<{ mp: string; answerKind: string; count: number; suggestedPlaybook: string }>;
    evidencePacks: Array<{ mp: string; title: string; detail: string }>;
    freshness: { mp: string; generatedAt: string; recentSampleSize: number; auditTotal: number; status: string };
    simulation: { mp: string; score: number; status: string; checklist: Array<{ label: string; passed: boolean }> };
  };
};

type Mp81To110Execution = {
  automationRehearsal: {
    title: string;
    summary: string;
    shadowMode: { mp: string; score: number; status: string; detail: string };
    candidates: Array<{ mp: string; kind: string; readinessPct: number; recentCount: number; completedCount: number; nextStep: string }>;
    rollbackChecks: Array<{ mp: string; label: string; passed: boolean; detail: string }>;
    guardrails: Array<{ mp: string; label: string; passed: boolean; detail: string }>;
  };
  stakeholderExperience: {
    title: string;
    summary: string;
    score: number;
    audiences: Array<{ mp: string; label: string; count: number; detail: string }>;
    communicationPack: { mp: string; lines: string[]; promptStarterCount: number; operatingPacketLines: string[] };
    briefVariants: Array<{ mp: string; audience: string; brief: string }>;
    coachingQueue: Array<{ mp: string; actorName: string; total: number; nextStep: string }>;
    boardNarrative: { mp: string; headline: string; points: string[] };
  };
  predictiveTrust: {
    title: string;
    summary: string;
    score: number;
    signals: Array<{ mp: string; label: string; value: number; detail: string }>;
    qualityChecks: Array<{ mp: string; label: string; status: string; metric: string }>;
    cleanupQueue: Array<{ mp: string; label: string; count: number; recommendation: string }>;
  };
  orchestrationAndCollaboration: {
    title: string;
    summary: string;
    orchestrationMap: Array<{ mp: string; label: string; count: number; detail: string }>;
    toolReadiness: Array<{ mp: string; kind: string; readinessPct: number; detail: string }>;
    playbookHealth: {
      mp: string;
      active: number;
      completed: number;
      stale: number;
      templates: Array<{ id: string; title: string; reason: string; priority: string }>;
    };
    humanRouting: Array<{ mp: string; title: string; type: string; ownerHint: string; href: string | null }>;
    boundaries: Array<{ mp: string; label: string; count: number; detail: string }>;
    collaborationLenses: Array<{ mp: string; label: string; ready: boolean; detail: string }>;
  };
  commercialImpact: {
    title: string;
    summary: string;
    score: number;
    signals: Array<{ mp: string; label: string; value: number; detail: string }>;
    nextActions: string[];
  };
};

type Mp111To140Execution = {
  commercialControls: {
    title: string;
    summary: string;
    score: number;
    watches: Array<{ mp: string; label: string; ready: boolean; signal: string }>;
    actionPlan: string[];
  };
  operationalSecurity: {
    title: string;
    summary: string;
    score: number;
    operationalLenses: Array<{ mp: string; label: string; ready: boolean; detail: string }>;
    securityChecks: Array<{ mp: string; label: string; passed: boolean; detail: string }>;
  };
  adminEvaluation: {
    title: string;
    summary: string;
    score: number;
    governanceItems: Array<{ mp: string; label: string; count: number; detail: string }>;
    evaluationItems: Array<{ mp: string; label: string; count: number; detail: string }>;
    releaseGate: { mp: string; passed: boolean; checks: Array<{ label: string; passed: boolean }> };
  };
  enterpriseTwin: {
    title: string;
    summary: string;
    score: number;
    readinessSignals: Array<{ mp: string; label: string; value: number; detail: string }>;
    twinFlows: Array<{ label: string; ready: boolean; detail: string }>;
    operatingModel: Array<{ mp: string; label: string; detail: string }>;
  };
};

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
  slaPosture: {
    status: string;
    actionCompletionPct: number;
    playbookCompletionPct: number;
    openInboxCount: number;
    stalePlaybookCount: number;
    oldestPendingActionDays: number;
  };
  trainingQueue: {
    positive: Array<{ id: string; prompt: string; answerKind: string; reason: string; createdAt: string }>;
    corrections: Array<{ id: string; prompt: string; answerKind: string; reason: string; createdAt: string }>;
  };
  promptLibrary: {
    candidates: Array<{ id: string; title: string; prompt: string; reason: string }>;
  };
  decisionJournal: {
    events: Array<{ id: string; type: string; label: string; detail: string; at: string }>;
  };
  signalHygiene: {
    items: Array<{ id: string; label: string; count: number; recommendation: string }>;
  };
  programLayers: CommandCenterLayer[];
  maturityLayers: CommandCenterLayer[];
  horizonLayers: CommandCenterLayer[];
  advancedLayers: CommandCenterLayer[];
  mp51To80Execution: Mp51To80Execution;
  mp81To110Execution: Mp81To110Execution;
  mp111To140Execution: Mp111To140Execution;
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
  const mvp = data.mp51To80Execution;
  const mvpNext = data.mp81To110Execution;
  const mvpThird = data.mp111To140Execution;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">MP20-MP189</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">Assistant command center</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              One operating view for cross-workspace work, feedback quality, queued actions, active playbooks, recent
              memory, assistant health, priority lanes, review queues, automation readiness, rollout confidence,
              adoption, experiments, daily cadence, handoff, evidence, training, governance, value, expansion, scale
              planning, process intelligence, knowledge, automation rehearsal, stakeholder reporting, predictive
              operations, data quality, orchestration, collaboration, security, evaluation, enterprise readiness,
              digital twins, planning, network collaboration, finance, sustainability, resilience, integrations, global
              governance, copilot UX, and autonomous readiness.
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

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">MP50-MP69</p>
            <h3 className="mt-1 text-base font-semibold text-zinc-950">Assistant program layers</h3>
            <p className="mt-1 max-w-3xl text-sm text-zinc-600">
              The next 20 mega phases are grouped into governance, value, domain expansion, and scale operations so the roadmap stays usable.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-4">
          {data.programLayers.map((layer) => (
            <div key={layer.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{layer.range}</p>
                  <h4 className="mt-1 font-semibold text-zinc-950">{layer.title}</h4>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 shadow-sm">{layer.score}/100</span>
              </div>
              <p className="mt-2 text-xs text-zinc-600">{layer.summary}</p>
              <div className="mt-4 space-y-2">
                {layer.items.map((item) => (
                  <div key={item.mp} className="rounded-xl border border-white bg-white p-3 text-sm shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-zinc-900">{item.mp} · {item.label}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          item.status === "ready" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">MP51-MP80 MVP</p>
          <h3 className="mt-1 text-base font-semibold text-zinc-950">Execution workbench</h3>
          <p className="mt-1 max-w-4xl text-sm text-zinc-700">
            This is the real operating layer for MP51-MP80: controls, value, expansion, scale, process intelligence,
            knowledge assets, and simulation readiness using live assistant telemetry.
          </p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-emerald-100 bg-white p-4">
            <h4 className="font-semibold text-zinc-950">{mvp.controlRoom.title}</h4>
            <p className="mt-1 text-xs text-zinc-600">{mvp.controlRoom.summary}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {mvp.controlRoom.controls.map((control) => (
                <div key={control.mp} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900">{control.mp} · {control.label}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${control.status === "pass" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {control.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{control.metric}</p>
                  <p className="mt-2 text-xs text-zinc-700">{control.nextAction}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-zinc-950">{mvp.valueRealization.title}</h4>
                <p className="mt-1 text-xs text-zinc-600">{mvp.valueRealization.summary}</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                {mvp.valueRealization.score}/100
              </span>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-5">
              {mvp.valueRealization.signals.map((signal) => (
                <div key={signal.mp} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <p className="text-xs font-semibold text-zinc-500">{signal.mp}</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-950">{signal.value}</p>
                  <p className="text-xs font-semibold text-zinc-800">{signal.label}</p>
                  <p className="mt-1 text-xs text-zinc-600">{signal.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {mvp.valueRealization.backlog.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">No value backlog yet.</p>
              ) : (
                mvp.valueRealization.backlog.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                    <p className="font-semibold text-zinc-900">{item.title}</p>
                    <p className="mt-1 text-xs text-zinc-600">{item.reason}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{item.priority}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-white p-4">
            <h4 className="font-semibold text-zinc-950">{mvp.expansionPlanner.title}</h4>
            <p className="mt-1 text-xs text-zinc-600">{mvp.expansionPlanner.summary}</p>
            <div className="mt-4 space-y-2">
              {mvp.expansionPlanner.rankedDomains.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">No domain signals yet.</p>
              ) : (
                mvp.expansionPlanner.rankedDomains.slice(0, 4).map((domain) => (
                  <div key={domain.objectType} className="rounded-xl border border-zinc-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-zinc-900">{domain.objectType}</p>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{domain.score}</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">{domain.detail}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-4">
            <h4 className="font-semibold text-zinc-950">{mvp.scaleOps.title}</h4>
            <p className="mt-1 text-xs text-zinc-600">{mvp.scaleOps.summary}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {mvp.scaleOps.kpis.map((kpi) => (
                <div key={kpi.label} className="rounded-xl bg-zinc-50 p-3 text-sm">
                  <p className="text-xl font-semibold text-zinc-950">{kpi.value}{kpi.suffix}</p>
                  <p className="text-xs text-zinc-600">{kpi.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {mvp.scaleOps.roadmap30Day.slice(0, 3).map((item) => (
                <div key={`${item.horizon}-${item.title}`} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{item.horizon}</p>
                  <p className="mt-1 font-semibold text-zinc-900">{item.title}</p>
                  <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-4">
            <h4 className="font-semibold text-zinc-950">{mvp.processIntelligence.title}</h4>
            <p className="mt-1 text-xs text-zinc-600">{mvp.processIntelligence.summary}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              {mvp.processIntelligence.paths.map((path) => (
                <div key={path.label} className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xl font-semibold text-zinc-950">{path.count}</p>
                  <p className="text-xs text-zinc-600">{path.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {mvp.processIntelligence.bottlenecks.map((item) => (
                <div key={item.label} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900">{item.label}</p>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{item.count}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{item.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-emerald-100 bg-white p-4">
            <h4 className="font-semibold text-zinc-950">{mvp.knowledgeSimulation.title}</h4>
            <p className="mt-1 text-xs text-zinc-600">{mvp.knowledgeSimulation.summary}</p>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Knowledge candidates</p>
                <div className="mt-2 space-y-2">
                  {mvp.knowledgeSimulation.knowledgeCandidates.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                      <p className="font-semibold text-zinc-900">{item.title}</p>
                      <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Playbook mappings</p>
                <div className="mt-2 space-y-2">
                  {mvp.knowledgeSimulation.mappings.slice(0, 3).map((item) => (
                    <div key={item.answerKind} className="rounded-xl border border-zinc-200 p-3 text-sm">
                      <p className="font-semibold text-zinc-900">{item.suggestedPlaybook}</p>
                      <p className="mt-1 text-xs text-zinc-600">{item.count} answer(s) of kind {item.answerKind}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Evidence packs</p>
                <div className="mt-2 space-y-2">
                  {mvp.knowledgeSimulation.evidencePacks.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">No evidence packs needed.</p>
                  ) : (
                    mvp.knowledgeSimulation.evidencePacks.slice(0, 3).map((item) => (
                      <div key={item.title} className="rounded-xl border border-zinc-200 p-3 text-sm">
                        <p className="font-semibold text-zinc-900">{item.title}</p>
                        <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-zinc-950">MP80 simulation readiness</h4>
                <p className="mt-1 text-xs text-zinc-600">
                  Freshness: {mvp.knowledgeSimulation.freshness.status} · {mvp.knowledgeSimulation.freshness.recentSampleSize} recent sample(s)
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                {mvp.knowledgeSimulation.simulation.score}/100
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {mvp.knowledgeSimulation.simulation.checklist.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 p-3 text-sm">
                  <p className="text-zinc-800">{item.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.passed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {item.passed ? "pass" : "watch"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">MP81-MP110 MVP</p>
          <h3 className="mt-1 text-base font-semibold text-zinc-950">Execution workbench 2</h3>
          <p className="mt-1 max-w-4xl text-sm text-zinc-700">
            This finishes MP81-MP110 as operational product work: shadow automation, stakeholder reporting,
            predictive trust, orchestration, collaboration lenses, and commercial impact.
          </p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-blue-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-zinc-950">{mvpNext.automationRehearsal.title}</h4>
                <p className="mt-1 text-xs text-zinc-600">{mvpNext.automationRehearsal.summary}</p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
                {mvpNext.automationRehearsal.shadowMode.score}/100
              </span>
            </div>
            <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
              {mvpNext.automationRehearsal.shadowMode.mp}: {mvpNext.automationRehearsal.shadowMode.detail}
            </p>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {mvpNext.automationRehearsal.candidates.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-200 p-3 text-sm text-zinc-500">No automation candidates yet.</p>
              ) : (
                mvpNext.automationRehearsal.candidates.slice(0, 4).map((item) => (
                  <div key={item.kind} className="rounded-xl border border-zinc-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-zinc-900">{item.kind}</p>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{item.readinessPct}%</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">{item.completedCount}/{item.recentCount} complete · {item.nextStep}</p>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {[...mvpNext.automationRehearsal.rollbackChecks, ...mvpNext.automationRehearsal.guardrails].slice(0, 6).map((item) => (
                <div key={`${item.mp}-${item.label}`} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-zinc-900">{item.label}</p>
                    <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.passed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {item.passed ? "pass" : "watch"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-zinc-950">{mvpNext.stakeholderExperience.title}</h4>
                <p className="mt-1 text-xs text-zinc-600">{mvpNext.stakeholderExperience.summary}</p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
                {mvpNext.stakeholderExperience.score}/100
              </span>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {mvpNext.stakeholderExperience.audiences.map((audience) => (
                <div key={audience.label} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <p className="text-xl font-semibold text-zinc-950">{audience.count}</p>
                  <p className="text-xs font-semibold text-zinc-800">{audience.label}</p>
                  <p className="mt-1 text-xs text-zinc-600">{audience.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {mvpNext.stakeholderExperience.briefVariants.map((item) => (
                <div key={item.audience} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <p className="font-semibold text-zinc-900">{item.audience}</p>
                  <p className="mt-1 text-xs text-zinc-600">{item.brief}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <p className="font-semibold text-zinc-900">{mvpNext.stakeholderExperience.boardNarrative.headline}</p>
              {mvpNext.stakeholderExperience.boardNarrative.points.map((point) => (
                <p key={point} className="mt-1 text-xs text-zinc-600">{point}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-zinc-950">{mvpNext.predictiveTrust.title}</h4>
                <p className="mt-1 text-xs text-zinc-600">{mvpNext.predictiveTrust.summary}</p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">{mvpNext.predictiveTrust.score}/100</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {mvpNext.predictiveTrust.signals.slice(0, 4).map((signal) => (
                <div key={signal.label} className="rounded-xl bg-zinc-50 p-3 text-sm">
                  <p className="text-xl font-semibold text-zinc-950">{signal.value}</p>
                  <p className="text-xs font-semibold text-zinc-800">{signal.label}</p>
                  <p className="mt-1 text-xs text-zinc-600">{signal.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {mvpNext.predictiveTrust.qualityChecks.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-zinc-900">{item.label}</p>
                    <p className="mt-1 text-xs text-zinc-600">{item.metric}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.status === "pass" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-4">
            <h4 className="font-semibold text-zinc-950">{mvpNext.orchestrationAndCollaboration.title}</h4>
            <p className="mt-1 text-xs text-zinc-600">{mvpNext.orchestrationAndCollaboration.summary}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              {mvpNext.orchestrationAndCollaboration.orchestrationMap.map((item) => (
                <div key={item.label} className="rounded-xl bg-zinc-50 p-3">
                  <p className="text-xl font-semibold text-zinc-950">{item.count}</p>
                  <p className="text-xs text-zinc-600">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {mvpNext.orchestrationAndCollaboration.boundaries.map((item) => (
                <div key={item.label} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900">{item.label}</p>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{item.count}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {mvpNext.orchestrationAndCollaboration.collaborationLenses.map((item) => (
                <div key={item.label} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900">{item.label}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {item.ready ? "ready" : "watch"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-zinc-950">{mvpNext.commercialImpact.title}</h4>
                <p className="mt-1 text-xs text-zinc-600">{mvpNext.commercialImpact.summary}</p>
              </div>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">{mvpNext.commercialImpact.score}/100</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {mvpNext.commercialImpact.signals.map((signal) => (
                <div key={signal.label} className="rounded-xl bg-zinc-50 p-3 text-sm">
                  <p className="text-xl font-semibold text-zinc-950">{signal.value}</p>
                  <p className="text-xs font-semibold text-zinc-800">{signal.label}</p>
                  <p className="mt-1 text-xs text-zinc-600">{signal.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {mvpNext.commercialImpact.nextActions.map((item) => (
                <p key={item} className="rounded-xl border border-zinc-200 p-3 text-sm text-zinc-700">{item}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-purple-200 bg-purple-50/40 p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-700">MP111-MP140 MVP</p>
          <h3 className="mt-1 text-base font-semibold text-zinc-950">Execution workbench 3</h3>
          <p className="mt-1 max-w-4xl text-sm text-zinc-700">
            This finishes MP111-MP140 as concrete operating product: commercial controls, operational intelligence,
            security/compliance posture, admin/evaluation governance, enterprise readiness, and digital-twin readiness.
          </p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-purple-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-zinc-950">{mvpThird.commercialControls.title}</h4>
                <p className="mt-1 text-xs text-zinc-600">{mvpThird.commercialControls.summary}</p>
              </div>
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-900">
                {mvpThird.commercialControls.score}/100
              </span>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {mvpThird.commercialControls.watches.map((watch) => (
                <div key={watch.mp} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900">{watch.mp} · {watch.label}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${watch.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                      {watch.ready ? "ready" : "watch"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{watch.signal}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {mvpThird.commercialControls.actionPlan.map((item) => (
                <p key={item} className="rounded-xl border border-zinc-200 p-3 text-sm text-zinc-700">{item}</p>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-purple-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-zinc-950">{mvpThird.operationalSecurity.title}</h4>
                <p className="mt-1 text-xs text-zinc-600">{mvpThird.operationalSecurity.summary}</p>
              </div>
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-900">
                {mvpThird.operationalSecurity.score}/100
              </span>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-5">
              {mvpThird.operationalSecurity.operationalLenses.map((lens) => (
                <div key={lens.mp} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <p className="text-xs font-semibold text-zinc-500">{lens.mp}</p>
                  <p className="mt-1 font-semibold text-zinc-900">{lens.label}</p>
                  <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${lens.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {lens.ready ? "ready" : "watch"}
                  </span>
                  <p className="mt-2 text-xs text-zinc-600">{lens.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {mvpThird.operationalSecurity.securityChecks.map((check) => (
                <div key={check.mp} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-zinc-900">{check.mp} · {check.label}</p>
                    <p className="mt-1 text-xs text-zinc-600">{check.detail}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${check.passed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {check.passed ? "pass" : "watch"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-purple-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-zinc-950">{mvpThird.adminEvaluation.title}</h4>
                <p className="mt-1 text-xs text-zinc-600">{mvpThird.adminEvaluation.summary}</p>
              </div>
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-900">
                {mvpThird.adminEvaluation.score}/100
              </span>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-5">
              {mvpThird.adminEvaluation.governanceItems.map((item) => (
                <div key={item.mp} className="rounded-xl bg-zinc-50 p-3 text-sm">
                  <p className="text-xs font-semibold text-zinc-500">{item.mp}</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-950">{item.count}</p>
                  <p className="text-xs font-semibold text-zinc-800">{item.label}</p>
                  <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-5">
              {mvpThird.adminEvaluation.evaluationItems.map((item) => (
                <div key={item.mp} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <p className="text-xs font-semibold text-zinc-500">{item.mp}</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-950">{item.count}</p>
                  <p className="text-xs font-semibold text-zinc-800">{item.label}</p>
                  <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-4">
              {mvpThird.adminEvaluation.releaseGate.checks.map((check) => (
                <div key={check.label} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 text-sm">
                  <p className="text-zinc-800">{check.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${check.passed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {check.passed ? "pass" : "watch"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-purple-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-zinc-950">{mvpThird.enterpriseTwin.title}</h4>
                <p className="mt-1 text-xs text-zinc-600">{mvpThird.enterpriseTwin.summary}</p>
              </div>
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-900">
                {mvpThird.enterpriseTwin.score}/100
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {mvpThird.enterpriseTwin.readinessSignals.map((signal) => (
                <div key={signal.mp} className="rounded-xl bg-zinc-50 p-3 text-sm">
                  <p className="text-xs font-semibold text-zinc-500">{signal.mp}</p>
                  <p className="mt-1 text-xl font-semibold text-zinc-950">{signal.value}</p>
                  <p className="text-xs font-semibold text-zinc-800">{signal.label}</p>
                  <p className="mt-1 text-xs text-zinc-600">{signal.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {mvpThird.enterpriseTwin.twinFlows.map((flow) => (
                <div key={flow.label} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-zinc-900">{flow.label}</p>
                    <p className="mt-1 text-xs text-zinc-600">{flow.detail}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${flow.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {flow.ready ? "ready" : "watch"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {mvpThird.enterpriseTwin.operatingModel.slice(0, 4).map((item) => (
                <div key={`${item.mp}-${item.label}`} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{item.mp} · {item.label}</p>
                  <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">MP70-MP89</p>
            <h3 className="mt-1 text-base font-semibold text-zinc-950">Assistant maturity layers</h3>
            <p className="mt-1 max-w-3xl text-sm text-zinc-600">
              The next 20 mega phases turn assistant operations into process intelligence, reusable knowledge,
              automation rehearsal, and stakeholder-ready reporting.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-4">
          {data.maturityLayers.map((layer) => (
            <div key={layer.id} className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{layer.range}</p>
                  <h4 className="mt-1 font-semibold text-zinc-950">{layer.title}</h4>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-indigo-900 shadow-sm">{layer.score}/100</span>
              </div>
              <p className="mt-2 text-xs text-zinc-600">{layer.summary}</p>
              <div className="mt-4 space-y-2">
                {layer.items.map((item) => (
                  <div key={item.mp} className="rounded-xl border border-white bg-white p-3 text-sm shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-zinc-900">{item.mp} · {item.label}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          item.status === "ready" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">MP90-MP139</p>
            <h3 className="mt-1 text-base font-semibold text-zinc-950">Assistant horizon layers</h3>
            <p className="mt-1 max-w-3xl text-sm text-zinc-600">
              The next 50 mega phases expand the assistant program into predictive operations, trust, orchestration,
              collaboration, commercial and operational intelligence, compliance, admin governance, evaluation, and enterprise readiness.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {data.horizonLayers.map((layer) => (
            <div key={layer.id} className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">{layer.range}</p>
                  <h4 className="mt-1 font-semibold text-zinc-950">{layer.title}</h4>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-cyan-900 shadow-sm">{layer.score}/100</span>
              </div>
              <p className="mt-2 text-xs text-zinc-600">{layer.summary}</p>
              <div className="mt-4 grid gap-2 md:grid-cols-5">
                {layer.items.map((item) => (
                  <div key={item.mp} className="rounded-xl border border-white bg-white p-3 text-sm shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-zinc-900">{item.mp}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          item.status === "ready" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-zinc-800">{item.label}</p>
                    <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">MP140-MP189</p>
            <h3 className="mt-1 text-base font-semibold text-zinc-950">Assistant advanced layers</h3>
            <p className="mt-1 max-w-3xl text-sm text-zinc-600">
              The next 50 mega phases move the assistant toward digital twin readiness, planning, network collaboration,
              finance controls, sustainability, resilience, ecosystem integration, global governance, copilot UX, and staged autonomy.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {data.advancedLayers.map((layer) => (
            <div key={layer.id} className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">{layer.range}</p>
                  <h4 className="mt-1 font-semibold text-zinc-950">{layer.title}</h4>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-violet-900 shadow-sm">{layer.score}/100</span>
              </div>
              <p className="mt-2 text-xs text-zinc-600">{layer.summary}</p>
              <div className="mt-4 grid gap-2 md:grid-cols-5">
                {layer.items.map((item) => (
                  <div key={item.mp} className="rounded-xl border border-white bg-white p-3 text-sm shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-zinc-900">{item.mp}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          item.status === "ready" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-zinc-800">{item.label}</p>
                    <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">SLA posture</h3>
          <p className="mt-1 text-sm text-zinc-600">MP45 service posture for assistant-assisted work.</p>
          <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 p-4">
            <p className="text-3xl font-semibold text-sky-950">{data.slaPosture.status}</p>
            <p className="mt-1 text-xs text-sky-900">Oldest pending action: {data.slaPosture.oldestPendingActionDays} day(s)</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-zinc-100 p-3">
              <p className="text-xl font-semibold">{data.slaPosture.actionCompletionPct}%</p>
              <p className="text-xs text-zinc-600">Action completion</p>
            </div>
            <div className="rounded-xl bg-zinc-100 p-3">
              <p className="text-xl font-semibold">{data.slaPosture.playbookCompletionPct}%</p>
              <p className="text-xs text-zinc-600">Playbook completion</p>
            </div>
            <div className="rounded-xl bg-zinc-100 p-3">
              <p className="text-xl font-semibold">{data.slaPosture.openInboxCount}</p>
              <p className="text-xs text-zinc-600">Open inbox</p>
            </div>
            <div className="rounded-xl bg-zinc-100 p-3">
              <p className="text-xl font-semibold">{data.slaPosture.stalePlaybookCount}</p>
              <p className="text-xs text-zinc-600">Stale playbooks</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Training queue</h3>
          <p className="mt-1 text-sm text-zinc-600">MP46 examples to reuse for tuning and corrections.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Positive examples</p>
              <div className="mt-2 space-y-2">
                {data.trainingQueue.positive.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No positive examples yet.</p>
                ) : (
                  data.trainingQueue.positive.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm">
                      <p className="font-semibold text-emerald-950">{item.prompt}</p>
                      <p className="mt-1 text-xs text-emerald-800">{item.answerKind} · {item.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Correction examples</p>
              <div className="mt-2 space-y-2">
                {data.trainingQueue.corrections.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No correction examples yet.</p>
                ) : (
                  data.trainingQueue.corrections.slice(0, 3).map((item) => (
                    <div key={`${item.reason}-${item.id}`} className="rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-sm">
                      <p className="font-semibold text-rose-950">{item.prompt}</p>
                      <p className="mt-1 text-xs text-rose-800">{item.answerKind} · {item.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Prompt library</h3>
          <p className="mt-1 text-sm text-zinc-600">MP47 reusable prompt-starter candidates.</p>
          <div className="mt-4 space-y-2">
            {data.promptLibrary.candidates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No prompt candidates yet.</p>
            ) : (
              data.promptLibrary.candidates.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <p className="font-semibold text-zinc-900">{item.title}</p>
                  <p className="mt-1 text-xs text-zinc-600">{item.prompt}</p>
                  <p className="mt-2 text-xs text-zinc-500">{item.reason}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Decision journal</h3>
          <p className="mt-1 text-sm text-zinc-600">MP48 recent feedback, action, and playbook decisions.</p>
          <div className="mt-4 space-y-2">
            {data.decisionJournal.events.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No decisions logged yet.</p>
            ) : (
              data.decisionJournal.events.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900">{item.label}</p>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{item.type}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{item.detail}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(item.at)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-950">Signal hygiene</h3>
          <p className="mt-1 text-sm text-zinc-600">MP49 noisy telemetry and cleanup items.</p>
          <div className="mt-4 space-y-2">
            {data.signalHygiene.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">No signal hygiene issues detected.</p>
            ) : (
              data.signalHygiene.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-zinc-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900">{item.label}</p>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{item.count}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{item.recommendation}</p>
                </div>
              ))
            )}
          </div>
        </div>
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
