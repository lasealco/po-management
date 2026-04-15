"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Widget = {
  id: string;
  title: string;
  savedReport: { id: string; name: string; updatedAt: string };
  report: {
    config: { measure: string; dimension: string };
    rows: Array<{ key: string; label: string; metrics: Record<string, number> }>;
    generatedAt: string;
  };
};
type ChartView = "bar" | "line";
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

function formatDecimal(value: number, frac = 2): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  }).format(value);
}

function formatMetric(measure: string, value: number): string {
  if (measure === "onTimePct") return `${formatDecimal(value, 2)}%`;
  if (measure === "shippingSpend") return formatDecimal(value, 2);
  return formatDecimal(value, 2);
}

function metricValue(widget: Widget): string {
  const m = widget.report.config.measure;
  const sum = widget.report.rows.reduce((acc, r) => acc + Number(r.metrics[m] ?? 0), 0);
  if (m === "onTimePct") return formatMetric(m, sum / Math.max(widget.report.rows.length, 1));
  return formatMetric(m, sum);
}

function seriesFor(widget: Widget): Array<{ label: string; value: number }> {
  const measure = widget.report.config.measure;
  return widget.report.rows
    .slice(0, 10)
    .map((r) => ({ label: r.label, value: Number(r.metrics[measure] ?? 0) }));
}

function colorFor(i: number): string {
  return BAR_COLORS[i % BAR_COLORS.length];
}

function MiniBarChart({ data, height = 64 }: { data: Array<{ label: string; value: number }>; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 0);
  if (!data.length || max <= 0) {
    return <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs text-zinc-500">No chart data</div>;
  }
  const barW = Math.max(8, Math.floor(220 / data.length));
  const gap = 3;
  const width = data.length * (barW + gap) + 48;
  const axisLeft = 36;
  const axisBottom = 14;
  const axisTop = 6;
  const plotHeight = height - axisBottom - axisTop;
  const ticks = [max, max / 2, 0];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ height: `${height}px` }}
      className="w-full rounded border border-zinc-200 bg-white"
    >
      {ticks.map((t, idx) => {
        const y = axisTop + (plotHeight * idx) / (ticks.length - 1);
        return (
          <g key={`tick-${idx}`}>
            <line x1={axisLeft} y1={y} x2={width - 2} y2={y} stroke="#e4e4e7" strokeWidth="1" />
            <text x={axisLeft - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#71717a">
              {formatDecimal(t, 0)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = Math.max(2, Math.round((d.value / max) * plotHeight));
        const x = axisLeft + i * (barW + gap);
        const y = axisTop + plotHeight - h;
        return (
          <rect key={d.label + i} x={x} y={y} width={barW} height={h} rx={1} fill={colorFor(i)}>
            <title>{`${d.label}: ${formatDecimal(d.value, 2)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function MiniLineChart({ data, height = 64 }: { data: Array<{ label: string; value: number }>; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 0);
  if (!data.length || max <= 0) {
    return <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs text-zinc-500">No chart data</div>;
  }
  const width = 320;
  const pad = 18;
  const plotH = height - pad * 2;
  const step = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;
  const points = data
    .map((d, i) => `${pad + i * step},${pad + plotH - (d.value / max) * plotH}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height: `${height}px` }} className="w-full rounded border border-zinc-200 bg-white">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#e4e4e7" />
      <polyline fill="none" stroke="#0ea5e9" strokeWidth="2.5" points={points} />
    </svg>
  );
}

export function ControlTowerDashboardWidgets({ canEdit }: { canEdit: boolean }) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Widget | null>(null);
  const [chartView, setChartView] = useState<ChartView>("bar");

  const load = useCallback(async () => {
    const res = await fetch("/api/control-tower/dashboard/widgets");
    const json = (await res.json()) as { widgets?: Widget[]; error?: string };
    if (!res.ok) {
      setErr(json.error || res.statusText);
      return;
    }
    setErr(null);
    setWidgets(json.widgets ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const remove = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/control-tower/dashboard/widgets/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      await load();
    },
    [load],
  );

  if (widgets.length === 0 && !err) return null;

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-zinc-900">My report widgets</h2>
      <Link
        href="/control-tower/dashboard"
        className="mb-3 inline-block text-sm font-medium text-sky-800 hover:underline"
      >
        Manage layout →
      </Link>
      {err ? <p className="mb-3 text-sm text-red-700">{err}</p> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {widgets.map((w) => (
          <article key={w.id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">{w.title}</h3>
              {canEdit ? (
                <button
                  type="button"
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-800"
                  onClick={() => void remove(w.id)}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {w.report.config.measure} by {w.report.config.dimension}
            </p>
            <p className="mt-2 text-2xl font-semibold text-zinc-950">{metricValue(w)}</p>
            <button
              type="button"
              onClick={() => {
                setExpanded(w);
                setChartView("bar");
              }}
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
                  <span className="font-medium">
                    {formatMetric(w.report.config.measure, Number(r.metrics[w.report.config.measure] ?? 0))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-zinc-500">
              Updated {new Date(w.report.generatedAt).toLocaleString()}
            </p>
            <Link
              href="/control-tower/reports"
              className="mt-2 inline-block text-xs font-medium text-sky-800 hover:underline"
            >
              Open reports →
            </Link>
          </article>
        ))}
      </div>
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
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded border border-zinc-300 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setChartView("bar")}
                    className={`rounded px-2 py-1 ${chartView === "bar" ? "bg-zinc-900 text-white" : "text-zinc-700"}`}
                  >
                    Bar
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartView("line")}
                    className={`rounded px-2 py-1 ${chartView === "line" ? "bg-zinc-900 text-white" : "text-zinc-700"}`}
                  >
                    Line
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded(null)}
                  className="rounded border border-zinc-300 px-3 py-1 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
            {chartView === "bar" ? (
              <MiniBarChart data={seriesFor(expanded)} height={280} />
            ) : (
              <MiniLineChart data={seriesFor(expanded)} height={280} />
            )}
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
                  <span className="font-medium">
                    {formatMetric(expanded.report.config.measure, r.value)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-zinc-500">
              {expanded.report.config.measure} by {expanded.report.config.dimension}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
