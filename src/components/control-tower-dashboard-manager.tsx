"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Widget = {
  id: string;
  title: string;
  sortOrder: number;
  layout: unknown;
  savedReport: { id: string; name: string; updatedAt: string };
  report: {
    config: { measure: string; dimension: string };
    rows: Array<{ key: string; label: string; metrics: Record<string, number> }>;
    generatedAt: string;
  };
};

type Span = 1 | 2 | 3;
const BAR_COLORS = [
  "#0284c7",
  "#6366f1",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0f766e",
  "#c2410c",
  "#be185d",
  "#334155",
];

function metricValue(widget: Widget): string {
  const m = widget.report.config.measure;
  const sum = widget.report.rows.reduce((acc, r) => acc + Number(r.metrics[m] ?? 0), 0);
  if (m === "onTimePct") return `${(sum / Math.max(widget.report.rows.length, 1)).toFixed(2)}%`;
  if (m === "shippingSpend") return `$${sum.toFixed(2)}`;
  return sum.toLocaleString();
}

function getSpan(layout: unknown): Span {
  const obj = layout && typeof layout === "object" ? (layout as Record<string, unknown>) : {};
  const n = Number(obj.span);
  if (n === 2 || n === 3) return n;
  return 1;
}

function seriesFor(widget: Widget): Array<{ label: string; value: number }> {
  const measure = widget.report.config.measure;
  return widget.report.rows
    .slice(0, 12)
    .map((r) => ({ label: r.label, value: Number(r.metrics[measure] ?? 0) }));
}

function colorFor(i: number): string {
  return BAR_COLORS[i % BAR_COLORS.length];
}

function MiniBarChart({ data, height = 72 }: { data: Array<{ label: string; value: number }>; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 0);
  if (!data.length || max <= 0) {
    return <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-3 text-xs text-zinc-500">No chart data</div>;
  }
  const barW = Math.max(8, Math.floor(260 / data.length));
  const gap = 3;
  const width = data.length * (barW + gap);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ height: `${height}px` }}
      className="w-full rounded border border-zinc-200 bg-white"
    >
      {data.map((d, i) => {
        const h = Math.max(2, Math.round((d.value / max) * (height - 10)));
        const x = i * (barW + gap);
        const y = height - h - 2;
        return (
          <rect key={d.label + i} x={x} y={y} width={barW} height={h} rx={1} fill={colorFor(i)}>
            <title>{`${d.label}: ${d.value.toFixed(2)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function ControlTowerDashboardManager({ canEdit }: { canEdit: boolean }) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Widget | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/control-tower/dashboard/widgets");
    const data = (await res.json()) as { widgets?: Widget[]; error?: string };
    if (!res.ok) {
      setErr(data.error || res.statusText);
      return;
    }
    setErr(null);
    const sorted = [...(data.widgets ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    setWidgets(sorted);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persistOrder = useCallback(async (next: Widget[]) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await Promise.all(
        next.map((w, idx) =>
          fetch(`/api/control-tower/dashboard/widgets/${w.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: idx }),
          }),
        ),
      );
      setMsg("Layout order saved.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save order.");
    } finally {
      setBusy(false);
    }
  }, [load]);

  const move = useCallback(
    async (id: string, delta: -1 | 1) => {
      const idx = widgets.findIndex((w) => w.id === id);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= widgets.length) return;
      const next = [...widgets];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      setWidgets(next);
      await persistOrder(next);
    },
    [persistOrder, widgets],
  );

  const dropBefore = useCallback(
    async (targetId: string) => {
      if (!dragId || dragId === targetId) return;
      const from = widgets.findIndex((w) => w.id === dragId);
      const to = widgets.findIndex((w) => w.id === targetId);
      if (from < 0 || to < 0) return;
      const next = [...widgets];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      setWidgets(next);
      setDragId(null);
      await persistOrder(next);
    },
    [dragId, persistOrder, widgets],
  );

  const setSpan = useCallback(
    async (id: string, span: Span) => {
      setBusy(true);
      setErr(null);
      setMsg(null);
      try {
        const widget = widgets.find((w) => w.id === id);
        const base = widget?.layout && typeof widget.layout === "object" ? (widget.layout as Record<string, unknown>) : {};
        const layoutJson = { ...base, span };
        const res = await fetch(`/api/control-tower/dashboard/widgets/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ layoutJson }),
        });
        const j = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(j.error || res.statusText);
        setMsg("Widget size saved.");
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to save widget size.");
      } finally {
        setBusy(false);
      }
    },
    [load, widgets],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusy(true);
      setErr(null);
      setMsg(null);
      try {
        const res = await fetch(`/api/control-tower/dashboard/widgets/${id}`, {
          method: "DELETE",
        });
        const j = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(j.error || res.statusText);
        setMsg("Widget removed.");
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to remove widget.");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const gridClass = useMemo(() => "grid gap-3 md:grid-cols-3", []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">My dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Arrange your pinned report widgets. Reorder and resize cards for your preferred operations view.
          </p>
        </div>
        <Link href="/control-tower/reports" className="rounded border border-sky-300 px-3 py-1.5 text-sm text-sky-900">
          Open report builder
        </Link>
      </div>

      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {err ? <p className="text-sm text-red-700">{err}</p> : null}

      {widgets.length === 0 ? (
        <p className="rounded border border-zinc-200 bg-white px-3 py-4 text-sm text-zinc-600">
          No widgets yet. Save and pin reports from the Reports page.
        </p>
      ) : (
        <div className={gridClass}>
          {widgets.map((w, idx) => {
            const span = getSpan(w.layout);
            const spanClass = span === 3 ? "md:col-span-3" : span === 2 ? "md:col-span-2" : "md:col-span-1";
            return (
              <article
                key={w.id}
                draggable={canEdit}
                onDragStart={() => setDragId(w.id)}
                onDragOver={(e) => {
                  if (canEdit) e.preventDefault();
                }}
                onDrop={() => {
                  void dropBefore(w.id);
                }}
                className={`rounded-lg border border-zinc-200 bg-white p-4 shadow-sm ${spanClass} ${
                  dragId === w.id ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-zinc-900">{w.title}</h2>
                  {canEdit ? (
                    <div className="flex items-center gap-1">
                      <span className="cursor-grab rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700">
                        Drag
                      </span>
                      <button
                        type="button"
                        disabled={busy || idx === 0}
                        onClick={() => void move(w.id, -1)}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        disabled={busy || idx === widgets.length - 1}
                        onClick={() => void move(w.id, 1)}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(w.id)}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-800 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {w.report.config.measure} by {w.report.config.dimension}
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-950">{metricValue(w)}</p>
                <button
                  type="button"
                  onClick={() => setExpanded(w)}
                  className="mt-2 block w-full text-left"
                  title="Open chart preview"
                >
                  <MiniBarChart data={seriesFor(w)} />
                  <span className="mt-1 inline-block text-[11px] font-medium text-sky-800">Click to enlarge chart</span>
                </button>
                <ul className="mt-3 space-y-1 text-xs text-zinc-700">
                  {w.report.rows.slice(0, 4).map((r, i) => (
                    <li key={r.key} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded"
                          style={{ backgroundColor: colorFor(i) }}
                        />
                        <span className="truncate">{r.label}</span>
                      </span>
                      <span className="font-medium">{Number(r.metrics[w.report.config.measure] ?? 0).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>Updated {new Date(w.report.generatedAt).toLocaleString()}</span>
                  {canEdit ? (
                    <div className="flex items-center gap-1">
                      <span>Width</span>
                      {[1, 2, 3].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void setSpan(w.id, s as Span)}
                          className={`rounded border px-1.5 py-0.5 ${
                            span === s ? "border-sky-400 bg-sky-50 text-sky-900" : "border-zinc-300 text-zinc-700"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {expanded ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setExpanded(null)}
        >
          <div
            className="w-full max-w-4xl rounded-xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-900">{expanded.title}</h3>
              <button
                type="button"
                onClick={() => setExpanded(null)}
                className="rounded border border-zinc-300 px-3 py-1 text-sm"
              >
                Close
              </button>
            </div>
            <MiniBarChart data={seriesFor(expanded)} height={280} />
            <ul className="mt-3 grid gap-1 text-xs text-zinc-700 md:grid-cols-2">
              {seriesFor(expanded).slice(0, 12).map((r, i) => (
                <li key={r.label + i} className="flex items-center justify-between gap-2 rounded bg-zinc-50 px-2 py-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded"
                      style={{ backgroundColor: colorFor(i) }}
                    />
                    <span className="truncate">{r.label}</span>
                  </span>
                  <span className="font-medium">{r.value.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-zinc-500">
              {expanded.report.config.measure} by {expanded.report.config.dimension}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
