"use client";

import { useCallback, useMemo, useState } from "react";

const CT_REPORT_MEASURES = [
  "shipments",
  "volumeCbm",
  "weightKg",
  "shippingSpend",
  "onTimePct",
  "avgDelayDays",
] as const;
type CtReportMeasure = (typeof CT_REPORT_MEASURES)[number];

type CtReportCoverage = {
  totalShipmentsQueried: number;
  shipmentsAggregated: number;
  excludedByDateOrMissingDateField: number;
  dimensionGroupsTotal: number;
  dimensionGroupsShown: number;
};

export const BAR_COLORS = [
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

export type ChartViewMode = "bar" | "line" | "pie";

export type CtDashboardWidgetReport = {
  config: {
    measure: CtReportMeasure;
    dimension: string;
    chartType?: string;
    dateField?: string;
    topN?: number;
  };
  rows: Array<{ key: string; label: string; metrics: Record<CtReportMeasure, number> }>;
  fullSeriesRows?: Array<{ key: string; label: string; metrics: Record<CtReportMeasure, number> }>;
  coverage?: CtReportCoverage;
  totals?: Record<string, number>;
  generatedAt: string;
};

export function formatDecimal(value: number, frac = 2): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  }).format(value);
}

export function formatMetric(measure: string, value: number): string {
  if (measure === "onTimePct") return `${formatDecimal(value, 2)}%`;
  if (measure === "shippingSpend") return formatDecimal(value, 2);
  return formatDecimal(value, 2);
}

export function colorFor(i: number): string {
  return BAR_COLORS[i % BAR_COLORS.length];
}

/** Compact series for small cards (first buckets only). */
export function seriesForCard(report: CtDashboardWidgetReport, max = 10): Array<{ label: string; value: number }> {
  const measure = report.config.measure;
  return report.rows.slice(0, max).map((r) => ({ label: r.label, value: Number(r.metrics[measure] ?? 0) }));
}

/** Full chart series from saved Top-N rows (matches report builder chart). */
export function seriesForChart(report: CtDashboardWidgetReport): Array<{ label: string; value: number }> {
  const measure = report.config.measure;
  return report.rows.map((r) => ({ label: r.label, value: Number(r.metrics[measure] ?? 0) }));
}

export function metricSummaryValue(report: CtDashboardWidgetReport): string {
  const m = report.config.measure;
  const sum = report.rows.reduce((acc, r) => acc + Number(r.metrics[m] ?? 0), 0);
  if (m === "onTimePct") return formatMetric(m, sum / Math.max(report.rows.length, 1));
  return formatMetric(m, sum);
}

export function tableRowsFromReport(report: CtDashboardWidgetReport) {
  return report.fullSeriesRows?.length ? report.fullSeriesRows : report.rows;
}

function csvCell(s: string): string {
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function reportToCsv(report: CtDashboardWidgetReport): string {
  const rows = tableRowsFromReport(report);
  const headers = ["label", ...CT_REPORT_MEASURES];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.label),
        ...CT_REPORT_MEASURES.map((m) => csvCell(String(Number(r.metrics[m] ?? 0)))),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w\-.,]+/g, "_").slice(0, 80) + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function MiniBarChart({ data, height = 64 }: { data: Array<{ label: string; value: number }>; height?: number }) {
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

export function MiniLineChart({ data, height = 64 }: { data: Array<{ label: string; value: number }>; height?: number }) {
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
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ height: `${height}px` }}
      className="w-full rounded border border-zinc-200 bg-white"
    >
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#e4e4e7" />
      <polyline fill="none" stroke="#0ea5e9" strokeWidth="2.5" points={points} />
    </svg>
  );
}

function pieSlicePath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

export function MiniPieChart({ data, size = 200 }: { data: Array<{ label: string; value: number }>; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data.length || total <= 0) {
    return <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-6 text-center text-xs text-zinc-500">No chart data</div>;
  }
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  let angle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const sweep = (d.value / total) * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + sweep;
    angle = a1;
    const path = pieSlicePath(cx, cy, r, a0, a1);
    return <path key={d.label + i} d={path} fill={colorFor(i)} stroke="#fff" strokeWidth="1"><title>{`${d.label}: ${formatDecimal(d.value, 2)}`}</title></path>;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto rounded border border-zinc-200 bg-white">
      {slices}
    </svg>
  );
}

function chartViewFromConfig(chartType: string | undefined): ChartViewMode {
  if (chartType === "line" || chartType === "pie") return chartType;
  return "bar";
}

function CoverageSummary({ coverage }: { coverage?: CtReportCoverage }) {
  if (!coverage) {
    return <p className="text-xs text-zinc-500">Shipment coverage is not available for this widget.</p>;
  }
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
      <p>
        <span className="font-semibold text-zinc-900">{formatDecimal(coverage.shipmentsAggregated, 0)}</span> shipments in
        this report (after filters). Queried up to{" "}
        <span className="font-medium">{formatDecimal(coverage.totalShipmentsQueried, 0)}</span> matching rows.
      </p>
      {coverage.excludedByDateOrMissingDateField > 0 ? (
        <p className="mt-1 text-amber-900">
          <span className="font-semibold">{formatDecimal(coverage.excludedByDateOrMissingDateField, 0)}</span> excluded:
          missing the selected date field (shipped / received / booking ETA per report) or outside the configured date
          range.
        </p>
      ) : (
        <p className="mt-1 text-zinc-600">None excluded for missing or out-of-range dates.</p>
      )}
      {coverage.dimensionGroupsTotal > coverage.dimensionGroupsShown ? (
        <p className="mt-1 text-zinc-600">
          Showing top <span className="font-medium">{coverage.dimensionGroupsShown}</span> of{" "}
          <span className="font-medium">{coverage.dimensionGroupsTotal}</span> dimension groups in the chart; the table
          below lists all groups.
        </p>
      ) : null}
    </div>
  );
}

export function ControlTowerDashboardWidgetModal(props: {
  title: string;
  report: CtDashboardWidgetReport;
  /** Sanitized report config for re-running the insight API. */
  savedReportConfig?: Record<string, unknown> | null;
  onClose: () => void;
}) {
  const { title, report, savedReportConfig, onClose } = props;
  const [chartView, setChartView] = useState<ChartViewMode>(() => chartViewFromConfig(report.config.chartType));
  const [insightQuestion, setInsightQuestion] = useState("");
  const [insightText, setInsightText] = useState<string | null>(null);
  const [insightBusy, setInsightBusy] = useState(false);
  const [insightErr, setInsightErr] = useState<string | null>(null);

  const chartData = useMemo(() => seriesForChart(report), [report]);

  const fetchInsight = useCallback(async () => {
    if (!savedReportConfig || Object.keys(savedReportConfig).length === 0) {
      setInsightErr("No report configuration loaded for AI.");
      return;
    }
    setInsightBusy(true);
    setInsightErr(null);
    try {
      const res = await fetch("/api/control-tower/reports/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: savedReportConfig,
          question: insightQuestion.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { insight?: string; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setInsightText(data.insight ?? "");
    } catch (e) {
      setInsightErr(e instanceof Error ? e.message : "Insight failed.");
      setInsightText(null);
    } finally {
      setInsightBusy(false);
    }
  }, [savedReportConfig, insightQuestion]);

  const tableRows = useMemo(() => tableRowsFromReport(report), [report]);
  const measure = report.config.measure;

  const onDownload = () => {
    downloadCsv(title, reportToCsv(report));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => onClose()}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ct-widget-modal-title"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 id="ct-widget-modal-title" className="text-base font-semibold text-zinc-900">
            {title}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded border border-zinc-300 p-0.5 text-xs">
              {(["bar", "line", "pie"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setChartView(v)}
                  className={`rounded px-2 py-1 capitalize ${chartView === v ? "bg-zinc-900 text-white" : "text-zinc-700"}`}
                >
                  {v}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => onClose()} className="rounded border border-zinc-300 px-3 py-1 text-sm">
              Close
            </button>
          </div>
        </div>

        <CoverageSummary coverage={report.coverage} />

        <div className="mt-3">
          {chartView === "bar" ? (
            <MiniBarChart data={chartData} height={280} />
          ) : chartView === "line" ? (
            <MiniLineChart data={chartData} height={280} />
          ) : (
            <MiniPieChart data={chartData} size={280} />
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onDownload}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Download CSV (all rows)
          </button>
          <span className="text-xs text-zinc-500">
            {tableRows.length} row{tableRows.length === 1 ? "" : "s"} · {measure} by {report.config.dimension}
          </span>
        </div>

        <div className="mt-3 max-h-56 overflow-auto rounded border border-zinc-200">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-zinc-100 text-zinc-700">
              <tr>
                <th className="border-b border-zinc-200 px-2 py-1.5 font-semibold">Label</th>
                {CT_REPORT_MEASURES.map((m) => (
                  <th key={m} className="border-b border-zinc-200 px-2 py-1.5 font-semibold">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.key} className="odd:bg-white even:bg-zinc-50">
                  <td className="border-b border-zinc-100 px-2 py-1 font-medium text-zinc-900">{r.label}</td>
                  {CT_REPORT_MEASURES.map((m) => (
                    <td key={m} className="border-b border-zinc-100 px-2 py-1 tabular-nums text-zinc-700">
                      {formatMetric(m, Number(r.metrics[m] ?? 0))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
          <p className="text-xs font-semibold text-violet-950">Ask AI about this report</p>
          <p className="mt-0.5 text-[11px] text-violet-900/80">
            Uses the same insight engine as the report builder (aggregated numbers only). Optional question:
          </p>
          <textarea
            className="mt-2 w-full rounded border border-violet-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
            rows={2}
            placeholder="e.g. What stands out? Any concentration risk?"
            value={insightQuestion}
            onChange={(e) => setInsightQuestion(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void fetchInsight()}
            disabled={insightBusy}
            className="mt-2 rounded bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {insightBusy ? "Generating…" : "Get AI insight"}
          </button>
          {insightErr ? <p className="mt-2 text-xs text-red-700">{insightErr}</p> : null}
          {insightText ? (
            <div className="mt-2 whitespace-pre-wrap rounded border border-violet-100 bg-white px-2 py-2 text-sm text-zinc-800">
              {insightText}
            </div>
          ) : null}
        </div>

        <p className="mt-3 text-xs text-zinc-500">Updated {new Date(report.generatedAt).toLocaleString()}</p>
      </div>
    </div>
  );
}

export function CoverageInline({ coverage }: { coverage?: CtReportCoverage }) {
  if (!coverage) return null;
  return (
    <p className="mt-1 text-[11px] leading-snug text-zinc-600">
      <span className="font-medium text-zinc-800">{formatDecimal(coverage.shipmentsAggregated, 0)}</span> shipments
      {coverage.excludedByDateOrMissingDateField > 0 ? (
        <>
          {" "}
          ·{" "}
          <span className="text-amber-800">
            {formatDecimal(coverage.excludedByDateOrMissingDateField, 0)} excluded (date missing / out of range)
          </span>
        </>
      ) : null}
    </p>
  );
}
