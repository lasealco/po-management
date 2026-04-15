"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ReportingCockpitSnapshot } from "@/lib/reporting/cockpit-types";

type WidgetType = "summary" | "exceptions" | "cashCycle" | "actions" | "drivers" | "ai";
type WidgetDef = { id: string; title: string; type: WidgetType; span: 1 | 2 };

const DEFAULT_LAYOUT: WidgetDef[] = [
  { id: "summary", title: "Cross-Module Pulse", type: "summary", span: 2 },
  { id: "exceptions", title: "Exceptions Wall", type: "exceptions", span: 1 },
  { id: "cashCycle", title: "Cash Cycle Signal", type: "cashCycle", span: 1 },
  { id: "drivers", title: "Top Drivers", type: "drivers", span: 1 },
  { id: "actions", title: "Suggested Actions", type: "actions", span: 1 },
  { id: "ai", title: "AI Executive Narrative", type: "ai", span: 2 },
];

function formatNumber(v: number, frac = 0) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  }).format(v);
}

function formatMoney(v: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(v);
}

function isLayout(v: unknown): v is WidgetDef[] {
  return (
    Array.isArray(v) &&
    v.every((w) => w && typeof w === "object" && typeof (w as { id?: unknown }).id === "string")
  );
}

export function ReportingCockpitBoard({
  snapshot,
}: {
  snapshot: ReportingCockpitSnapshot;
}) {
  const [layout, setLayout] = useState<WidgetDef[]>(DEFAULT_LAYOUT);
  const [dragId, setDragId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [insightBusy, setInsightBusy] = useState(false);
  const [insightErr, setInsightErr] = useState<string | null>(null);
  const [insightText, setInsightText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadPref() {
      try {
        const res = await fetch("/api/reporting/cockpit/layout");
        const j = (await res.json()) as { layout?: unknown };
        if (!res.ok || !active) return;
        if (isLayout(j.layout)) {
          const ids = new Set(DEFAULT_LAYOUT.map((d) => d.id));
          const cleaned = j.layout.filter((w) => ids.has(w.id));
          const missing = DEFAULT_LAYOUT.filter((d) => !cleaned.some((w) => w.id === d.id));
          setLayout([...cleaned, ...missing]);
        }
      } catch {
        // Keep defaults on failure.
      }
    }
    void loadPref();
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback(async (next: WidgetDef[]) => {
    setMsg(null);
    try {
      const res = await fetch("/api/reporting/cockpit/layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout: next }),
      });
      if (!res.ok) return;
      setMsg("Layout saved.");
    } catch {
      setMsg("Layout changed locally.");
    }
  }, []);

  const dropBefore = useCallback(
    async (targetId: string) => {
      if (!dragId || dragId === targetId) return;
      const from = layout.findIndex((w) => w.id === dragId);
      const to = layout.findIndex((w) => w.id === targetId);
      if (from < 0 || to < 0) return;
      const next = [...layout];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      setLayout(next);
      setDragId(null);
      await persist(next);
    },
    [dragId, layout, persist],
  );

  const setSpan = useCallback(
    async (id: string, span: 1 | 2) => {
      const next = layout.map((w) => (w.id === id ? { ...w, span } : w));
      setLayout(next);
      await persist(next);
    },
    [layout, persist],
  );

  const askAi = useCallback(async () => {
    setInsightBusy(true);
    setInsightErr(null);
    try {
      const res = await fetch("/api/reporting/cockpit/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() || undefined }),
      });
      const data = (await res.json()) as { insight?: string; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setInsightText(data.insight ?? "");
    } catch (e) {
      setInsightErr(e instanceof Error ? e.message : "Insight failed.");
    } finally {
      setInsightBusy(false);
    }
  }, [question]);

  const totalCashCycle = useMemo(
    () => snapshot.cashCycle.reduce((sum, c) => sum + c.amount, 0),
    [snapshot.cashCycle],
  );
  const topExceptions = useMemo(
    () => [...snapshot.exceptions].sort((a, b) => b.count - a.count).slice(0, 3),
    [snapshot.exceptions],
  );
  const topCash = useMemo(
    () => [...snapshot.cashCycle].sort((a, b) => b.amount - a.amount).slice(0, 2),
    [snapshot.cashCycle],
  );

  return (
    <section className="mb-8 rounded-2xl border border-zinc-200 bg-white/70 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cockpit Board</p>
        <p className="text-xs text-zinc-500">{msg ?? "Drag cards to reorder. Resize by width toggle."}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {layout.map((w) => {
          const spanClass = w.span === 2 ? "md:col-span-2" : "md:col-span-1";
          return (
            <article
              key={w.id}
              draggable
              onDragStart={() => setDragId(w.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                void dropBefore(w.id);
              }}
              className={`rounded-xl border border-zinc-200 bg-white p-3 shadow-sm ${spanClass} ${
                dragId === w.id ? "opacity-60" : ""
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-900">{w.title}</h3>
                <div className="flex items-center gap-1">
                  <span className="cursor-grab rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] text-zinc-600">
                    Drag
                  </span>
                  <button
                    type="button"
                    onClick={() => void setSpan(w.id, 1)}
                    className={`rounded border px-1.5 py-0.5 text-[10px] ${w.span === 1 ? "border-sky-400 bg-sky-50 text-sky-900" : "border-zinc-300 text-zinc-700"}`}
                  >
                    1x
                  </button>
                  <button
                    type="button"
                    onClick={() => void setSpan(w.id, 2)}
                    className={`rounded border px-1.5 py-0.5 text-[10px] ${w.span === 2 ? "border-sky-400 bg-sky-50 text-sky-900" : "border-zinc-300 text-zinc-700"}`}
                  >
                    2x
                  </button>
                </div>
              </div>

              {w.type === "summary" ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs">
                    <p className="text-zinc-500">Open POs</p>
                    <p className="text-base font-semibold">{formatNumber(snapshot.summary.openPoCount)}</p>
                  </div>
                  <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs">
                    <p className="text-zinc-500">In-transit</p>
                    <p className="text-base font-semibold">{formatNumber(snapshot.summary.inTransitShipmentCount)}</p>
                  </div>
                  <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs">
                    <p className="text-zinc-500">Active opps</p>
                    <p className="text-base font-semibold">{formatNumber(snapshot.summary.activeOpportunityCount)}</p>
                  </div>
                </div>
              ) : null}

              {w.type === "exceptions" ? (
                <ul className="space-y-1.5 text-xs">
                  {snapshot.exceptions.map((e) => (
                    <li key={e.id} className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5">
                      <span className="truncate">{e.label}</span>
                      <a href={e.href} className="font-semibold text-sky-800 hover:underline">
                        {formatNumber(e.count)}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}

              {w.type === "cashCycle" ? (
                <div className="space-y-1.5">
                  {snapshot.cashCycle.map((c) => {
                    const width = totalCashCycle > 0 ? Math.max(8, Math.round((c.amount / totalCashCycle) * 100)) : 8;
                    return (
                      <div key={c.id} className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs">
                        <div className="mb-1 flex items-center justify-between">
                          <span>{c.label}</span>
                          <span className="font-semibold">{formatMoney(c.amount, snapshot.currency)}</span>
                        </div>
                        <div className="h-1.5 rounded bg-zinc-200">
                          <div className="h-1.5 rounded bg-gradient-to-r from-sky-500 to-violet-600" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {w.type === "actions" ? (
                <ul className="space-y-1.5 text-xs">
                  {snapshot.recommendedActions.map((a) => (
                    <li key={a.id} className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{a.title}</span>
                        <span className={`rounded px-1 py-0.5 ${a.priority === "P1" ? "bg-rose-100 text-rose-900" : "bg-amber-100 text-amber-900"}`}>
                          {a.priority}
                        </span>
                      </div>
                      <p className="mt-0.5 text-zinc-600">{a.reason}</p>
                      <a href={a.href} className="mt-1 inline-block text-sky-800 hover:underline">
                        Open →
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}

              {w.type === "drivers" ? (
                <div className="space-y-2 text-xs">
                  <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5">
                    <p className="mb-1 font-semibold text-zinc-700">Risk drivers</p>
                    {topExceptions.map((e) => (
                      <div key={e.id} className="flex items-center justify-between">
                        <span className="truncate text-zinc-700">{e.label}</span>
                        <span className="font-semibold text-zinc-900">{formatNumber(e.count)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5">
                    <p className="mb-1 font-semibold text-zinc-700">Cash concentration</p>
                    {topCash.map((c) => (
                      <div key={c.id} className="flex items-center justify-between">
                        <span className="truncate text-zinc-700">{c.label}</span>
                        <span className="font-semibold text-zinc-900">{formatMoney(c.amount, snapshot.currency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {w.type === "ai" ? (
                <div>
                  <textarea
                    className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                    rows={2}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask AI what to do next..."
                  />
                  <button
                    type="button"
                    onClick={() => void askAi()}
                    disabled={insightBusy}
                    className="mt-2 rounded bg-violet-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {insightBusy ? "Thinking…" : "Generate insight"}
                  </button>
                  {insightErr ? <p className="mt-1 text-xs text-red-700">{insightErr}</p> : null}
                  {insightText ? <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-700">{insightText}</p> : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
