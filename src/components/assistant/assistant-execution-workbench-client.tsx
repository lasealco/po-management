"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Tone = "ready" | "watch" | "critical";

type WorkbenchAction = {
  id: string;
  kind: string;
  label: string;
  description: string;
  href: string;
};

type WorkbenchItem = {
  id: string;
  title: string;
  subtitle: string;
  tone: Tone;
  href: string;
  evidence: string[];
  action: WorkbenchAction;
};

type WorkbenchSection = {
  id: string;
  lmpRange: string;
  title: string;
  summary: string;
  href: string;
  items: WorkbenchItem[];
};

type ExecutionPayload = {
  generatedAt: string;
  actor: { id: string; email: string; name: string };
  capabilities: Record<string, boolean>;
  metrics: Record<string, number>;
  sections: WorkbenchSection[];
};

const toneClass: Record<Tone, string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-900",
  watch: "border-amber-200 bg-amber-50 text-amber-950",
  critical: "border-rose-200 bg-rose-50 text-rose-900",
};

const toneLabel: Record<Tone, string> = {
  ready: "Ready",
  watch: "Watch",
  critical: "Critical",
};

export function AssistantExecutionWorkbenchClient() {
  const [data, setData] = useState<ExecutionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/assistant/execution-workbench", { method: "GET" });
      const raw = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiClientErrorMessage(raw, "Could not load execution workbench."));
      setData(raw as ExecutionPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load execution workbench.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const queueAction = async (section: WorkbenchSection, item: WorkbenchItem) => {
    setQueued((prev) => ({ ...prev, [item.action.id]: "Queueing..." }));
    try {
      const res = await fetch("/api/assistant/action-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `${section.lmpRange}: ${section.title} · ${item.title}`,
          objectType: section.id,
          objectId: item.id,
          action: item.action,
        }),
      });
      const raw = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiClientErrorMessage(raw, "Could not queue action."));
      setQueued((prev) => ({ ...prev, [item.action.id]: "Queued for review" }));
    } catch (err) {
      setQueued((prev) => ({
        ...prev,
        [item.action.id]: err instanceof Error ? err.message : "Could not queue action.",
      }));
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
        Loading LMP11-LMP30 execution workbench...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900 shadow-sm">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const totalItems = data.sections.reduce((sum, section) => sum + section.items.length, 0);
  const criticalItems = data.sections.flatMap((section) => section.items).filter((item) => item.tone === "critical").length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">LMP11-LMP30</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Execution workbench</h2>
            <p className="mt-2 max-w-4xl text-sm text-zinc-600">
              This large-MP layer covers carrier and customer communication, delivery promises, WMS recovery,
              pricing/RFQ/invoice handoffs, commercial risk, role/action operations, playbooks, memory, evidence,
              training, prompt candidates, quality gates, and shadow automation readiness.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Metric label="Signals" value={totalItems} helper="Live execution rows" />
          <Metric label="Critical" value={criticalItems} helper="Need urgent review" />
          <Metric label="Pending actions" value={data.metrics.pendingActionCount ?? 0} helper="Human approval queue" />
          <Metric label="Audit events" value={data.metrics.auditTotal ?? 0} helper="Assistant memory base" />
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Operating Metrics</p>
            <p className="mt-1 text-sm text-zinc-600">
              Generated {new Date(data.generatedAt).toLocaleString()} for {data.actor.name}.
            </p>
          </div>
          <Link
            href="/assistant/command-center"
            className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Open command center
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          {Object.entries(data.capabilities).map(([key, enabled]) => (
            <span
              key={key}
              className={`rounded-full border px-3 py-1 ${
                enabled ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-zinc-50 text-zinc-500"
              }`}
            >
              {key}: {enabled ? "on" : "no grant"}
            </span>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {data.sections.map((section) => (
          <section key={section.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">
                  {section.lmpRange}
                </p>
                <h3 className="mt-1 text-base font-semibold text-zinc-950">{section.title}</h3>
                <p className="mt-1 text-sm text-zinc-600">{section.summary}</p>
              </div>
              <Link
                href={section.href}
                className="shrink-0 rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Open area
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {section.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                  No live rows for this section with the current grants/data. The LMP workflow is ready and will populate
                  as records arrive.
                </div>
              ) : (
                section.items.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link href={item.href} className="font-semibold text-zinc-950 hover:underline">
                          {item.title}
                        </Link>
                        <p className="mt-1 text-xs text-zinc-500">{item.subtitle}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass[item.tone]}`}>
                        {toneLabel[item.tone]}
                      </span>
                    </div>

                    <ul className="mt-3 space-y-1 text-xs text-zinc-600">
                      {item.evidence.map((line) => (
                        <li key={line}>- {line}</li>
                      ))}
                    </ul>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void queueAction(section, item)}
                        className="rounded-xl bg-[var(--arscmp-primary)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                      >
                        Queue action
                      </button>
                      <Link
                        href={item.action.href}
                        className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                      >
                        {item.action.label}
                      </Link>
                      {queued[item.action.id] ? (
                        <span className="text-xs font-medium text-zinc-500">{queued[item.action.id]}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">{item.action.description}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-950">{value}</p>
      <p className="text-xs text-zinc-500">{helper}</p>
    </div>
  );
}
