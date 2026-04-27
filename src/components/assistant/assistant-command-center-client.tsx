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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">MP20-MP24</p>
            <h2 className="mt-1 text-xl font-semibold text-zinc-950">Assistant command center</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              One operating view for cross-workspace work, feedback quality, queued actions, active playbooks, recent
              memory, and assistant health.
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
