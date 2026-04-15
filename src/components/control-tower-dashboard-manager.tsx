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

export function ControlTowerDashboardManager({ canEdit }: { canEdit: boolean }) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
              <article key={w.id} className={`rounded-lg border border-zinc-200 bg-white p-4 shadow-sm ${spanClass}`}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-zinc-900">{w.title}</h2>
                  {canEdit ? (
                    <div className="flex gap-1">
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
                    </div>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {w.report.config.measure} by {w.report.config.dimension}
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-950">{metricValue(w)}</p>
                <ul className="mt-3 space-y-1 text-xs text-zinc-700">
                  {w.report.rows.slice(0, 4).map((r) => (
                    <li key={r.key} className="flex items-center justify-between gap-2">
                      <span className="truncate">{r.label}</span>
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
    </div>
  );
}
