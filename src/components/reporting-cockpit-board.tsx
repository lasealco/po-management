"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { CockpitWeekPair, ReportingCockpitSnapshot } from "@/lib/reporting/cockpit-types";

type WidgetType = "summary" | "exceptions" | "cashCycle" | "actions" | "drivers" | "ai";
type WidgetDef = { id: string; title: string; type: WidgetType; span: 1 | 2 };
type AutoRefreshTrigger = "timer" | "visibility" | "toggle";

function autoTriggerLabel(t: AutoRefreshTrigger): string {
  if (t === "timer") return "Timer";
  if (t === "visibility") return "Returned to tab";
  return "On enable";
}

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

function weekDelta(pair: CockpitWeekPair): number {
  return pair.last7 - pair.prev7;
}

function DeltaHint({ pair, moreIsWorse }: { pair: CockpitWeekPair; moreIsWorse?: boolean }) {
  const d = weekDelta(pair);
  const good = moreIsWorse ? d < 0 : d > 0;
  const bad = moreIsWorse ? d > 0 : d < 0;
  const tone = d === 0 ? "text-zinc-500" : good ? "text-emerald-700" : bad ? "text-rose-700" : "text-zinc-500";
  const arrow = d > 0 ? "↑" : d < 0 ? "↓" : "→";
  return (
    <span className={`font-medium ${tone}`}>
      {arrow} {d > 0 ? "+" : ""}
      {d} vs prior
    </span>
  );
}

function isLayout(v: unknown): v is WidgetDef[] {
  return (
    Array.isArray(v) &&
    v.every((w) => w && typeof w === "object" && typeof (w as { id?: unknown }).id === "string")
  );
}

function isKeyboardTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

/** Snapshot server time → human label; `nowMs` should tick periodically for “Xm ago”. */
function formatSnapshotAge(iso: string, nowMs: number): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffSec = Math.floor((nowMs - t) / 1000);
  if (diffSec < 8) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(iso).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

const LS_AUTO_REFRESH = "reporting.cockpitAutoRefresh";
const LS_AUTO_REFRESH_MIN = "reporting.cockpitAutoRefreshMin";

/** Only run a catch-up refresh after the tab was hidden at least this long (avoids churn on quick alt-tabs). */
const VISIBILITY_RESUME_MIN_HIDDEN_MS = 45_000;
/** Don’t fire resume refresh more often than this (e.g. rapid focus/blur). */
const VISIBILITY_RESUME_COOLDOWN_MS = 15_000;

function readAutoRefreshPrefs(): { enabled: boolean; minutes: 5 | 10 | 15 } {
  if (typeof window === "undefined") return { enabled: false, minutes: 5 };
  try {
    const enabled = window.localStorage.getItem(LS_AUTO_REFRESH) === "1";
    const raw = window.localStorage.getItem(LS_AUTO_REFRESH_MIN);
    const minutes = raw === "10" || raw === "15" ? Number(raw) : 5;
    return { enabled, minutes: minutes as 5 | 10 | 15 };
  } catch {
    return { enabled: false, minutes: 5 };
  }
}

export function ReportingCockpitBoard({
  snapshot: snapshotProp,
}: {
  snapshot: ReportingCockpitSnapshot;
}) {
  const [data, setData] = useState<ReportingCockpitSnapshot>(snapshotProp);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshErr, setRefreshErr] = useState<string | null>(null);
  const [layout, setLayout] = useState<WidgetDef[]>(DEFAULT_LAYOUT);
  const [dragId, setDragId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [insightBusy, setInsightBusy] = useState(false);
  const [insightErr, setInsightErr] = useState<string | null>(null);
  const [insightText, setInsightText] = useState<string | null>(null);
  const [insightRevealId, setInsightRevealId] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshMin, setAutoRefreshMin] = useState<5 | 10 | 15>(5);
  const [lastAutoAt, setLastAutoAt] = useState<number | null>(null);
  const [lastAutoOk, setLastAutoOk] = useState<boolean | null>(null);
  const [lastAutoTrigger, setLastAutoTrigger] = useState<AutoRefreshTrigger | null>(null);
  const refreshInFlight = useRef(false);
  const hiddenAtRef = useRef<number | null>(null);
  const lastVisibilityResumeAtRef = useRef<number>(0);

  useEffect(() => {
    setData(snapshotProp);
  }, [snapshotProp]);

  useEffect(() => {
    const { enabled, minutes } = readAutoRefreshPrefs();
    setAutoRefresh(enabled);
    setAutoRefreshMin(minutes);
  }, []);

  const refreshSnapshot = useCallback(async (opts?: {
    silent?: boolean;
    source?: "manual" | "auto";
    autoTrigger?: AutoRefreshTrigger;
  }) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    const silent = Boolean(opts?.silent);
    const source = opts?.source ?? "manual";
    const autoTrigger: AutoRefreshTrigger | null =
      source === "auto" ? (opts?.autoTrigger ?? "timer") : null;
    if (!silent) {
      setRefreshing(true);
      setRefreshErr(null);
    }
    try {
      const res = await fetch("/api/reporting/cockpit");
      const j = (await res.json()) as { snapshot?: ReportingCockpitSnapshot; error?: string };
      if (!res.ok) throw new Error(j.error || res.statusText);
      if (!j.snapshot) throw new Error("No snapshot returned.");
      setData(j.snapshot);
      const now = Date.now();
      setNowMs(now);
      setRefreshErr(null);
      if (source === "auto" && autoTrigger) {
        setLastAutoTrigger(autoTrigger);
        setLastAutoAt(now);
        setLastAutoOk(true);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Refresh failed.";
      setRefreshErr(message);
      if (source === "auto" && autoTrigger) {
        setLastAutoTrigger(autoTrigger);
        setLastAutoAt(Date.now());
        setLastAutoOk(false);
      }
    } finally {
      refreshInFlight.current = false;
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const ms = autoRefreshMin * 60 * 1000;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refreshSnapshot({ silent: true, source: "auto", autoTrigger: "timer" });
    }, ms);
    return () => window.clearInterval(id);
  }, [autoRefresh, autoRefreshMin, refreshSnapshot]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (document.visibilityState !== "visible") return;
      if (!autoRefresh) {
        hiddenAtRef.current = null;
        return;
      }
      const started = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (started == null) return;
      const hiddenFor = Date.now() - started;
      if (hiddenFor < VISIBILITY_RESUME_MIN_HIDDEN_MS) return;
      const now = Date.now();
      if (now - lastVisibilityResumeAtRef.current < VISIBILITY_RESUME_COOLDOWN_MS) return;
      lastVisibilityResumeAtRef.current = now;
      void refreshSnapshot({ silent: true, source: "auto", autoTrigger: "visibility" });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [autoRefresh, refreshSnapshot]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "r" && e.key !== "R") return;
      if (isKeyboardTypingTarget(e.target)) return;
      e.preventDefault();
      void refreshSnapshot(e.shiftKey ? { silent: true } : undefined);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [refreshSnapshot]);

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

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
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
    setInsightText(null);
    try {
      const res = await fetch("/api/reporting/cockpit/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() || undefined }),
      });
      const data = (await res.json()) as { insight?: string; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setInsightText(data.insight ?? "");
      setInsightRevealId((n) => n + 1);
    } catch (e) {
      setInsightErr(e instanceof Error ? e.message : "Insight failed.");
    } finally {
      setInsightBusy(false);
    }
  }, [question]);

  const totalCashCycle = useMemo(
    () => data.cashCycle.reduce((sum, c) => sum + c.amount, 0),
    [data.cashCycle],
  );
  const topExceptions = useMemo(
    () => [...data.exceptions].sort((a, b) => b.count - a.count).slice(0, 3),
    [data.exceptions],
  );
  const topCash = useMemo(
    () => [...data.cashCycle].sort((a, b) => b.amount - a.amount).slice(0, 2),
    [data.cashCycle],
  );

  const snapshotAgeLabel = useMemo(
    () => formatSnapshotAge(data.generatedAt, nowMs),
    [data.generatedAt, nowMs],
  );
  const autoStatusLabel = useMemo(() => {
    if (!autoRefresh || lastAutoAt == null || lastAutoOk == null) return null;
    const rel = formatSnapshotAge(new Date(lastAutoAt).toISOString(), nowMs);
    const hint = lastAutoTrigger ? ` · ${autoTriggerLabel(lastAutoTrigger)}` : "";
    return lastAutoOk ? `Auto refresh OK ${rel}${hint}` : `Auto refresh failed ${rel}${hint}`;
  }, [autoRefresh, lastAutoAt, lastAutoOk, lastAutoTrigger, nowMs]);

  const autoStatusTitle = useMemo(() => {
    if (!autoRefresh || lastAutoAt == null || lastAutoOk == null) return undefined;
    return [
      `Trigger: ${lastAutoTrigger ? autoTriggerLabel(lastAutoTrigger) : "unknown"}`,
      `Last auto attempt (local clock): ${new Date(lastAutoAt).toISOString()}`,
      `Result: ${lastAutoOk ? "OK" : "failed"}`,
      `Current snapshot generatedAt: ${data.generatedAt}`,
    ].join("\n");
  }, [autoRefresh, lastAutoAt, lastAutoOk, lastAutoTrigger, data.generatedAt]);

  return (
    <section className="mb-8 rounded-2xl border border-zinc-200 bg-white/70 p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cockpit Board</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {refreshErr ? <p className="max-w-[220px] text-right text-xs text-red-600">{refreshErr}</p> : null}
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-600">
            <input
              type="checkbox"
              className="rounded border-zinc-300"
              checked={autoRefresh}
                onChange={(e) => {
                const on = e.target.checked;
                setAutoRefresh(on);
                if (!on) {
                  setLastAutoTrigger(null);
                }
                try {
                  window.localStorage.setItem(LS_AUTO_REFRESH, on ? "1" : "0");
                } catch {
                  /* ignore */
                }
                if (on) {
                  void refreshSnapshot({ silent: true, source: "auto", autoTrigger: "toggle" });
                }
              }}
            />
            <span>Auto-refresh</span>
            <select
              className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-[11px] text-zinc-800 disabled:opacity-50"
              value={autoRefreshMin}
              disabled={!autoRefresh}
              onChange={(e) => {
                const v = e.target.value;
                const minutes: 5 | 10 | 15 = v === "10" ? 10 : v === "15" ? 15 : 5;
                setAutoRefreshMin(minutes);
                try {
                  window.localStorage.setItem(LS_AUTO_REFRESH_MIN, String(minutes));
                } catch {
                  /* ignore */
                }
              }}
              title="Interval while this tab is open"
            >
              <option value={5}>5 min</option>
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void refreshSnapshot()}
            disabled={refreshing}
            title="Reload cockpit snapshot from the server. R = refresh (when focus is not in a field). Shift+R = silent refresh (no button spinner)."
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh data"}
          </button>
          <p
            className="text-xs text-zinc-500"
            title={new Date(data.generatedAt).toLocaleString()}
          >
            {msg ?? `Refreshed ${snapshotAgeLabel}`}
          </p>
          {autoStatusLabel ? (
            <div className="flex flex-wrap items-center gap-1.5" title={autoStatusTitle}>
              <p className={`text-xs ${lastAutoOk ? "text-emerald-700" : "text-amber-700"}`}>
                {autoStatusLabel}
              </p>
              {autoRefresh && lastAutoOk === false ? (
                <button
                  type="button"
                  onClick={() => void refreshSnapshot()}
                  disabled={refreshing}
                  className="rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                  title="Run a full refresh now. Same as Refresh data — R when not typing, or Shift+R for silent refresh."
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {layout.map((w, i) => {
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
              style={{ "--cockpit-stagger": `${i * 55}ms` } as CSSProperties}
              className={`cockpit-card-enter rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition-shadow hover:shadow ${spanClass} ${
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
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs">
                      <p className="text-zinc-500">Open POs</p>
                      <p className="text-base font-semibold">{formatNumber(data.summary.openPoCount)}</p>
                    </div>
                    <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs">
                      <p className="text-zinc-500">In-transit</p>
                      <p className="text-base font-semibold">{formatNumber(data.summary.inTransitShipmentCount)}</p>
                    </div>
                    <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs">
                      <p className="text-zinc-500">Active opps</p>
                      <p className="text-base font-semibold">{formatNumber(data.summary.activeOpportunityCount)}</p>
                    </div>
                  </div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    New volume · {data.activityTrends.periodLabel}
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded border border-zinc-100 bg-white px-2 py-1 text-[11px] text-zinc-700">
                      <span>POs created</span>
                      <span className="tabular-nums">
                        {formatNumber(data.activityTrends.purchaseOrdersCreated.last7)}{" "}
                        <DeltaHint pair={data.activityTrends.purchaseOrdersCreated} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded border border-zinc-100 bg-white px-2 py-1 text-[11px] text-zinc-700">
                      <span>Shipments created</span>
                      <span className="tabular-nums">
                        {formatNumber(data.activityTrends.shipmentsCreated.last7)}{" "}
                        <DeltaHint pair={data.activityTrends.shipmentsCreated} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded border border-zinc-100 bg-white px-2 py-1 text-[11px] text-zinc-700">
                      <span>CT exceptions opened</span>
                      <span className="tabular-nums">
                        {formatNumber(data.activityTrends.ctExceptionsOpened.last7)}{" "}
                        <DeltaHint pair={data.activityTrends.ctExceptionsOpened} moreIsWorse />
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded border border-zinc-100 bg-white px-2 py-1 text-[11px] text-zinc-700">
                      <span>CRM activities</span>
                      <span className="tabular-nums">
                        {formatNumber(data.activityTrends.crmActivitiesCreated.last7)}{" "}
                        <DeltaHint pair={data.activityTrends.crmActivitiesCreated} />
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {w.type === "exceptions" ? (
                <ul className="space-y-1.5 text-xs">
                  {data.exceptions.length === 0 ? (
                    <li className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-900">
                      No active exceptions right now.
                    </li>
                  ) : (
                    data.exceptions.map((e) => (
                      <li key={e.id} className="flex items-center justify-between rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5">
                        <span className="truncate">{e.label}</span>
                        <a href={e.href} className="font-semibold text-sky-800 hover:underline">
                          {formatNumber(e.count)}
                        </a>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}

              {w.type === "cashCycle" ? (
                <div className="space-y-1.5">
                  {data.cashCycle.map((c) => {
                    const width = totalCashCycle > 0 ? Math.max(8, Math.round((c.amount / totalCashCycle) * 100)) : 8;
                    return (
                      <div key={c.id} className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs">
                        <div className="mb-1 flex items-center justify-between">
                          <span>{c.label}</span>
                          <span className="font-semibold">{formatMoney(c.amount, data.currency)}</span>
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
                  {data.recommendedActions.length === 0 ? (
                    <li className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-900">
                      No urgent actions detected. Keep monitoring.
                    </li>
                  ) : (
                    data.recommendedActions.map((a) => (
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
                    ))
                  )}
                </ul>
              ) : null}

              {w.type === "drivers" ? (
                <div className="space-y-2 text-xs">
                  <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5">
                    <p className="mb-1 font-semibold text-zinc-700">Risk drivers</p>
                    {topExceptions.length === 0 ? (
                      <p className="text-zinc-500">No exception risk spikes.</p>
                    ) : (
                      topExceptions.map((e) => (
                        <div key={e.id} className="flex items-center justify-between">
                          <span className="truncate text-zinc-700">{e.label}</span>
                          <span className="font-semibold text-zinc-900">{formatNumber(e.count)}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5">
                    <p className="mb-1 font-semibold text-zinc-700">Cash concentration</p>
                    {topCash.length === 0 ? (
                      <p className="text-zinc-500">No cash-cycle concentration detected.</p>
                    ) : (
                      topCash.map((c) => (
                        <div key={c.id} className="flex items-center justify-between">
                          <span className="truncate text-zinc-700">{c.label}</span>
                          <span className="font-semibold text-zinc-900">{formatMoney(c.amount, data.currency)}</span>
                        </div>
                      ))
                    )}
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
                  {insightText ? (
                    <p
                      key={insightRevealId}
                      className="cockpit-insight-reveal mt-1 whitespace-pre-wrap text-xs text-zinc-700"
                    >
                      {insightText}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
