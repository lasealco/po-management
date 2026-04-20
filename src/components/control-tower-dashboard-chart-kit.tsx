"use client";

import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { WorkbenchDrillLink } from "@/components/workbench-drill-link";
import { dimensionLabel, metricLabel } from "@/lib/control-tower/report-labels";
import type { ReportInsightRunSummary } from "@/lib/control-tower/report-run-summary";

const CT_REPORT_MEASURES = [
  "shipments",
  "volumeCbm",
  "weightKg",
  "shippingSpend",
  "onTimePct",
  "avgDelayDays",
  "openExceptions",
] as const;
type CtReportMeasure = (typeof CT_REPORT_MEASURES)[number];

type CtReportCoverage = {
  totalShipmentsQueried: number;
  shipmentsAggregated: number;
  excludedByDateOrMissingDateField: number;
  dimensionGroupsTotal: number;
  dimensionGroupsShown: number;
};

/**
 * Category colors — teal / cyan / emerald family aligned with `--arscmp-primary`.
 * Avoids generic “rainbow SaaS” purples for a more premium, on-brand analytics feel.
 */
export const CHART_CATEGORY_FILLS = [
  "#165b67",
  "#0e7490",
  "#0f766e",
  "#0d9488",
  "#115e59",
  "#155e75",
  "#134e4a",
  "#0891b2",
] as const;

/** @deprecated Use `CHART_CATEGORY_FILLS`; kept for external imports if any. */
export const BAR_COLORS = [...CHART_CATEGORY_FILLS];

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
  /** Present when loaded from `GET …/dashboard/widgets` or aligned run payloads. */
  runSummary?: ReportInsightRunSummary;
};

export function formatDecimal(value: number, frac = 2): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  }).format(value);
}

/** Whole units (shipment counts, row counts on axes). */
export function formatInteger(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatAxisTick(measure: string, value: number): string {
  if (measure === "shipments") return formatInteger(value);
  if (measure === "openExceptions") return formatInteger(value);
  if (measure === "onTimePct") return `${formatDecimal(value, 0)}%`;
  if (measure === "avgDelayDays") return formatDecimal(value, 1);
  return formatDecimal(value, 0);
}

export function formatMetric(measure: string, value: number): string {
  if (measure === "shipments") return formatInteger(value);
  if (measure === "openExceptions") return formatInteger(value);
  if (measure === "onTimePct") return `${formatDecimal(value, 2)}%`;
  if (measure === "shippingSpend") return formatDecimal(value, 2);
  if (measure === "avgDelayDays") return formatDecimal(value, 2);
  return formatDecimal(value, 2);
}

export function colorFor(i: number): string {
  return CHART_CATEGORY_FILLS[i % CHART_CATEGORY_FILLS.length]!;
}

const CHART_STROKE_PRIMARY = "#165b67";
const CHART_GRID = "#e7e5e4";

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (on) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", on);
      return () => mq.removeEventListener("change", on);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

type ChartHoverTip = { px: number; py: number; label: string; valueText: string };

function ChartHtmlTooltip({ tip }: { tip: ChartHoverTip | null }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-30 max-w-[220px] rounded-lg border border-zinc-200/90 bg-white/95 px-2.5 py-1.5 shadow-lg ring-1 ring-black/[0.06] backdrop-blur-sm"
      style={{
        left: tip.px,
        top: tip.py,
        transform: "translate(-50%, calc(-100% - 10px))",
      }}
    >
      <p className="truncate text-[11px] font-semibold leading-tight text-zinc-900">{tip.label}</p>
      <p className="text-xs font-semibold tabular-nums text-[var(--arscmp-primary)]">{tip.valueText}</p>
    </div>
  );
}

/** Compact series for small cards (first buckets only). */
export function seriesForCard(report: CtDashboardWidgetReport, max = 10): Array<{ label: string; value: number }> {
  const measure = report.config.measure;
  return report.rows.slice(0, max).map((r) => ({ label: r.label, value: Number(r.metrics[measure] ?? 0) }));
}

/** One point in a widget chart, keyed for drill-down to the data table row. */
export type ChartSeriesPoint = { key: string; label: string; value: number };

/** Full chart series from saved Top-N rows (matches report builder chart). */
export function seriesForChart(report: CtDashboardWidgetReport): ChartSeriesPoint[] {
  const measure = report.config.measure;
  return report.rows.map((r) => ({
    key: r.key,
    label: r.label,
    value: Number(r.metrics[measure] ?? 0),
  }));
}

function seriesKey(d: { key?: string; label: string; value: number }, index: number): string {
  return d.key ?? `i:${index}:${d.label}`;
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

export { dimensionLabel, metricLabel };

/** Line charts are meaningful for time (month); categorical dimensions use bars. */
function chartViewFromConfig(chartType: string | undefined, dimension: string): ChartViewMode {
  if (chartType === "pie") return "pie";
  if (chartType === "line" && dimension === "month") return "line";
  return "bar";
}

/** Card / hub thumbnail: mirrors modal chart mode; used for sparkline vs bar vs mini pie. */
export function widgetThumbnailChartMode(report: CtDashboardWidgetReport): ChartViewMode {
  return chartViewFromConfig(report.config.chartType, report.config.dimension ?? "month");
}

export function WidgetChartThumbnail({
  report,
  barHeight = 56,
  lineHeight = 44,
}: {
  report: CtDashboardWidgetReport;
  /** Height when the thumbnail is a bar chart. */
  barHeight?: number;
  /** Height when the thumbnail is a line (sparkline) chart. */
  lineHeight?: number;
}) {
  const mode = widgetThumbnailChartMode(report);
  const data = seriesForCard(report, 14);
  const measure = report.config.measure;
  if (mode === "line") {
    return <MiniLineChart data={data} height={lineHeight} measure={measure} variant="card" />;
  }
  if (mode === "pie" && data.length > 0 && data.length <= 7) {
    const pieSize = Math.round(Math.max(52, barHeight + 4));
    return (
      <div className="flex justify-center py-0.5">
        <MiniPieChart data={data} size={pieSize} measure={measure} />
      </div>
    );
  }
  return <MiniBarChart data={data} height={barHeight} measure={measure} variant="card" />;
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

export function MiniBarChart({
  data,
  height = 64,
  selectedKey = null,
  onBarSelect,
  measure = "shippingSpend",
  variant = "card",
  xGroupLabel,
}: {
  data: Array<{ key?: string; label: string; value: number }>;
  height?: number;
  selectedKey?: string | null;
  onBarSelect?: (key: string) => void;
  /** Drives number formatting (shipments = whole numbers). */
  measure?: string;
  /** `modal` draws readable Y ticks and X category labels. */
  variant?: "card" | "modal";
  /** X-axis caption in modal layout (e.g. “Month”). */
  xGroupLabel?: string;
}) {
  const interactive = Boolean(onBarSelect);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<ChartHoverTip | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const updateTip = useCallback(
    (e: ReactMouseEvent<SVGRectElement>, d: (typeof data)[number]) => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setTip({
        px: e.clientX - r.left,
        py: e.clientY - r.top,
        label: d.label,
        valueText: formatMetric(measure, d.value),
      });
    },
    [measure],
  );
  const max = Math.max(...data.map((d) => d.value), 0);
  if (!data.length || max <= 0) {
    return (
      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/90 px-3 py-4 text-center text-xs text-zinc-500">
        No chart data
      </div>
    );
  }
  const isModal = variant === "modal";
  const barW = isModal ? Math.max(10, Math.min(48, Math.floor(560 / Math.max(data.length, 1)))) : Math.max(8, Math.floor(220 / data.length));
  const gap = isModal ? 4 : 3;
  const axisLeft = isModal ? 52 : 36;
  const axisBottom = isModal ? 56 : 14;
  const axisTop = isModal ? 14 : 6;
  const axisRight = 8;
  const width = isModal
    ? Math.max(480, data.length * (barW + gap) + axisLeft + axisRight)
    : data.length * (barW + gap) + 48;
  const plotHeight = height - axisBottom - axisTop;
  const ticks = [max, max / 2, 0];
  const fmt = (v: number) => formatAxisTick(measure, v);
  const fmtVal = (v: number) => formatMetric(measure, v);
  const xLabel = (s: string) => (s.length > 11 ? `${s.slice(0, 10)}…` : s);
  const barRx = isModal ? 5 : 2;
  return (
    <div ref={wrapRef} className="relative w-full" onMouseLeave={() => setTip(null)}>
      <ChartHtmlTooltip tip={tip} />
      <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={isModal ? "xMidYMid meet" : "none"}
      style={{ height: `${height}px` }}
      className={`w-full rounded-xl border border-zinc-200/70 bg-gradient-to-b from-white to-zinc-50/90 shadow-md ring-1 ring-black/[0.04] ${interactive ? "[&_rect.bar]:cursor-pointer" : ""}`}
      role="img"
      aria-label={
        interactive
          ? "Bar chart; click a bar to highlight the matching row below."
          : "Bar chart"
      }
      onMouseMove={(ev) => {
        if (ev.target === ev.currentTarget) setTip(null);
      }}
    >
      <defs>
        {data.map((d, i) => {
          const base = colorFor(i);
          return (
            <linearGradient key={`g-${seriesKey(d, i)}`} id={`ct-bar-grad-${i}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={base} stopOpacity="0.82" />
              <stop offset="100%" stopColor={base} stopOpacity="1" />
            </linearGradient>
          );
        })}
      </defs>
      {isModal ? (
        <text
          x={12}
          y={axisTop + plotHeight / 2}
          fontSize="11"
          fill="#57534e"
          fontWeight="600"
          transform={`rotate(-90 12 ${axisTop + plotHeight / 2})`}
          textAnchor="middle"
        >
          {metricLabel(measure)}
        </text>
      ) : null}
      {ticks.map((t, idx) => {
        const y = axisTop + (plotHeight * idx) / (ticks.length - 1);
        return (
          <g key={`tick-${idx}`}>
            <line x1={axisLeft} y1={y} x2={width - axisRight} y2={y} stroke={CHART_GRID} strokeWidth="1" />
            <text x={axisLeft - 6} y={y + 4} textAnchor="end" fontSize={isModal ? "10" : "8"} fill="#57534e">
              {fmt(t)}
            </text>
          </g>
        );
      })}
      {isModal && xGroupLabel ? (
        <text
          x={axisLeft + (width - axisLeft - axisRight) / 2}
          y={height - 8}
          textAnchor="middle"
          fontSize="10"
          fill="#57534e"
        >
          {xGroupLabel}
        </text>
      ) : null}
      {data.map((d, i) => {
        const h = Math.max(2, Math.round((d.value / max) * plotHeight));
        const x = axisLeft + i * (barW + gap);
        const y = axisTop + plotHeight - h;
        const k = seriesKey(d, i);
        const sel = selectedKey != null && selectedKey === k;
        return (
          <g
            key={k}
            className={reducedMotion ? undefined : "ct-chart-bar-enter"}
            style={reducedMotion ? undefined : { animationDelay: `${Math.min(i, 14) * 22}ms` }}
          >
            <rect
              className="bar transition-[opacity] duration-300 motion-reduce:transition-none"
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={barRx}
              fill={`url(#ct-bar-grad-${i})`}
              stroke={sel ? CHART_STROKE_PRIMARY : "rgba(22, 91, 103, 0.12)"}
              strokeWidth={sel ? 2.5 : 1}
              tabIndex={interactive ? 0 : undefined}
              role={interactive ? "button" : undefined}
              aria-label={`${d.label}: ${fmtVal(d.value)}${sel ? ", selected" : ""}`}
              aria-pressed={interactive ? sel : undefined}
              onMouseEnter={(e) => updateTip(e, d)}
              onMouseMove={(e) => updateTip(e, d)}
              onClick={
                interactive
                  ? (e) => {
                      e.stopPropagation();
                      onBarSelect?.(k);
                    }
                  : undefined
              }
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onBarSelect?.(k);
                      }
                    }
                  : undefined
              }
            />
            {isModal ? (
              <text
                x={x + barW / 2}
                y={height - axisBottom + 14}
                textAnchor="end"
                fontSize="9"
                fill="#52525b"
                transform={`rotate(-42 ${x + barW / 2} ${height - axisBottom + 14})`}
              >
                {xLabel(d.label)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
    </div>
  );
}

export function MiniLineChart({
  data,
  height = 64,
  selectedKey = null,
  onPointSelect,
  measure = "shippingSpend",
  variant = "card",
  xGroupLabel,
}: {
  data: Array<{ key?: string; label: string; value: number }>;
  height?: number;
  selectedKey?: string | null;
  onPointSelect?: (key: string) => void;
  measure?: string;
  variant?: "card" | "modal";
  xGroupLabel?: string;
}) {
  const interactive = Boolean(onPointSelect);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<ChartHoverTip | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const updateTipPoint = useCallback(
    (e: ReactMouseEvent<SVGCircleElement>, d: (typeof data)[number]) => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setTip({
        px: e.clientX - r.left,
        py: e.clientY - r.top,
        label: d.label,
        valueText: formatMetric(measure, d.value),
      });
    },
    [measure],
  );
  const max = Math.max(...data.map((d) => d.value), 0);
  if (!data.length || max <= 0) {
    return (
      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/90 px-3 py-4 text-center text-xs text-zinc-500">
        No chart data
      </div>
    );
  }
  const isModal = variant === "modal";
  const width = isModal ? 680 : 320;
  const padL = isModal ? 56 : 18;
  const padR = isModal ? 20 : 18;
  const padT = isModal ? 18 : 18;
  const padB = isModal ? 62 : 18;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const n = data.length;
  const xAt = (i: number) => {
    if (n <= 1) return padL + plotW / 2;
    return padL + (i / (n - 1)) * plotW;
  };
  const yAt = (v: number) => padT + plotH - (v / max) * plotH;
  const yBottom = padT + plotH;
  const points = data.map((d, i) => `${xAt(i)},${yAt(d.value)}`).join(" ");
  const areaPoints =
    n > 0
      ? `${padL},${yBottom} ${data.map((d, i) => `${xAt(i)},${yAt(d.value)}`).join(" ")} ${xAt(n - 1)},${yBottom}`
      : "";
  const ticks = [max, max / 2, 0];
  const fmt = (v: number) => formatAxisTick(measure, v);
  const fmtVal = (v: number) => formatMetric(measure, v);
  const xLab = (s: string) => (s.length > 9 ? `${s.slice(0, 8)}…` : s);
  const hitR = isModal ? 16 : 14;
  return (
    <div ref={wrapRef} className="relative w-full" onMouseLeave={() => setTip(null)}>
      <ChartHtmlTooltip tip={tip} />
      <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={isModal ? "xMidYMid meet" : "none"}
      style={{ height: `${height}px` }}
      className="w-full rounded-xl border border-zinc-200/70 bg-gradient-to-b from-white to-zinc-50/90 shadow-md ring-1 ring-black/[0.04]"
      role="img"
      aria-label={
        interactive
          ? "Line chart; click a point to highlight the matching row below."
          : "Line chart"
      }
      onMouseMove={(ev) => {
        if (ev.target === ev.currentTarget) setTip(null);
      }}
    >
      <defs>
        <linearGradient id="ct-line-area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_STROKE_PRIMARY} stopOpacity="0.16" />
          <stop offset="100%" stopColor={CHART_STROKE_PRIMARY} stopOpacity="0" />
        </linearGradient>
      </defs>
      {isModal
        ? ticks.map((t, idx) => {
            const y = padT + (plotH * idx) / (ticks.length - 1);
            return (
              <g key={`yt-${idx}`}>
                <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={CHART_GRID} strokeWidth="1" />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#57534e">
                  {fmt(t)}
                </text>
              </g>
            );
          })
        : [<line key="base" x1={padL} y1={padT + plotH} x2={width - padR} y2={padT + plotH} stroke={CHART_GRID} />]}
      <g className={reducedMotion ? undefined : "ct-chart-line-enter"}>
        {n > 0 ? (
          <polygon fill="url(#ct-line-area-fill)" points={areaPoints} stroke="none" pointerEvents="none" />
        ) : null}
        <polyline
          fill="none"
          stroke={CHART_STROKE_PRIMARY}
          strokeWidth={isModal ? 2.75 : 2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          pointerEvents="none"
        />
      </g>
      {isModal ? (
        <text
          x={14}
          y={padT + plotH / 2}
          fontSize="11"
          fill="#57534e"
          fontWeight="600"
          transform={`rotate(-90 14 ${padT + plotH / 2})`}
          textAnchor="middle"
        >
          {metricLabel(measure)}
        </text>
      ) : null}
      {isModal && xGroupLabel ? (
        <text x={padL + plotW / 2} y={height - 10} textAnchor="middle" fontSize="10" fill="#57534e">
          {xGroupLabel}
        </text>
      ) : null}
      {data.map((d, i) => {
        const cx = xAt(i);
        const cy = yAt(d.value);
        const k = seriesKey(d, i);
        const sel = selectedKey != null && selectedKey === k;
        return (
          <g key={k}>
            <circle
              cx={cx}
              cy={cy}
              r={hitR}
              fill="transparent"
              className={interactive ? "cursor-pointer" : "cursor-default"}
              tabIndex={interactive ? 0 : undefined}
              role={interactive ? "button" : undefined}
              aria-hidden={interactive ? undefined : true}
              aria-label={
                interactive ? `${d.label}: ${fmtVal(d.value)}${sel ? ", selected" : ""}` : undefined
              }
              aria-pressed={interactive ? sel : undefined}
              onMouseEnter={(e) => updateTipPoint(e, d)}
              onMouseMove={(e) => updateTipPoint(e, d)}
              onClick={
                interactive
                  ? (e) => {
                      e.stopPropagation();
                      onPointSelect?.(k);
                    }
                  : undefined
              }
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onPointSelect?.(k);
                      }
                    }
                  : undefined
              }
            />
            {interactive ? (
              <>
                <circle
                  cx={cx}
                  cy={cy}
                  r={sel ? 6.5 : 4.5}
                  fill="#fff"
                  stroke={CHART_STROKE_PRIMARY}
                  strokeOpacity={sel ? 1 : 0.45}
                  strokeWidth={sel ? 2.75 : 2}
                  pointerEvents="none"
                />
                {isModal ? (
                  <text
                    x={cx}
                    y={height - padB + 12}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#57534e"
                    transform={`rotate(-38 ${cx} ${height - padB + 12})`}
                  >
                    {xLab(d.label)}
                  </text>
                ) : null}
              </>
            ) : null}
          </g>
        );
      })}
    </svg>
    </div>
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

export function MiniPieChart({
  data,
  size = 200,
  selectedKey = null,
  onSliceSelect,
  measure = "shippingSpend",
}: {
  data: Array<{ key?: string; label: string; value: number }>;
  size?: number;
  selectedKey?: string | null;
  onSliceSelect?: (key: string) => void;
  measure?: string;
}) {
  const interactive = Boolean(onSliceSelect);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<ChartHoverTip | null>(null);
  const updateTipSlice = useCallback(
    (e: ReactMouseEvent<SVGPathElement>, d: (typeof data)[number]) => {
      const el = wrapRef.current;
      if (!el) return;
      const rct = el.getBoundingClientRect();
      setTip({
        px: e.clientX - rct.left,
        py: e.clientY - rct.top,
        label: d.label,
        valueText: formatMetric(measure, d.value),
      });
    },
    [measure],
  );
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data.length || total <= 0) {
    return (
      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/90 px-3 py-6 text-center text-xs text-zinc-500">
        No chart data
      </div>
    );
  }
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const sliceAngles: { d: (typeof data)[number]; i: number; a0: number; a1: number }[] = [];
  {
    let angle = -Math.PI / 2;
    for (let i = 0; i < data.length; i += 1) {
      const d = data[i]!;
      const sweep = (d.value / total) * Math.PI * 2;
      const a0 = angle;
      const a1 = angle + sweep;
      sliceAngles.push({ d, i, a0, a1 });
      angle = a1;
    }
  }
  const slices = sliceAngles.map(({ d, i, a0, a1 }) => {
    const path = pieSlicePath(cx, cy, r, a0, a1);
    const k = seriesKey(d, i);
    const sel = selectedKey != null && selectedKey === k;
    return (
      <path
        key={k}
        d={path}
        fill={colorFor(i)}
        stroke={sel ? CHART_STROKE_PRIMARY : "#fff"}
        strokeWidth={sel ? 2.5 : 1}
        className={interactive ? "cursor-pointer" : undefined}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? "button" : undefined}
        aria-hidden={interactive ? undefined : true}
        aria-label={
          interactive
            ? `${d.label}: ${formatMetric(measure, d.value)}${sel ? ", selected" : ""}`
            : undefined
        }
        aria-pressed={interactive ? sel : undefined}
        onClick={
          interactive
            ? (e) => {
                e.stopPropagation();
                onSliceSelect?.(k);
              }
            : undefined
        }
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSliceSelect?.(k);
                }
              }
            : undefined
        }
        onMouseEnter={(e) => updateTipSlice(e, d)}
        onMouseMove={(e) => updateTipSlice(e, d)}
      />
    );
  });
  return (
    <div ref={wrapRef} className="relative mx-auto w-fit" onMouseLeave={() => setTip(null)}>
      <ChartHtmlTooltip tip={tip} />
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rounded-xl border border-zinc-200/70 bg-gradient-to-br from-white to-zinc-50/90 shadow-md ring-1 ring-black/[0.04]"
        role="img"
        aria-label={
          interactive
            ? "Pie chart; click a slice to highlight the matching row below."
            : "Pie chart"
        }
        onMouseMove={(ev) => {
          if (ev.target === ev.currentTarget) setTip(null);
        }}
      >
        {slices}
      </svg>
    </div>
  );
}

function CoverageSummary({ coverage }: { coverage?: CtReportCoverage }) {
  if (!coverage) {
    return <p className="text-xs text-zinc-500">Shipment coverage is not available for this widget.</p>;
  }
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
      <p>
        <span className="font-semibold text-zinc-900">{formatInteger(coverage.shipmentsAggregated)}</span> shipments in
        this report (after filters). Queried up to{" "}
        <span className="font-medium">{formatInteger(coverage.totalShipmentsQueried)}</span> matching rows.
      </p>
      {coverage.excludedByDateOrMissingDateField > 0 ? (
        <p className="mt-1 text-amber-900">
          <span className="font-semibold">{formatInteger(coverage.excludedByDateOrMissingDateField)}</span> excluded:
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
  /** When opening from a shared URL (`?widget=&drill=`), select this row key if it exists in the table. */
  initialDrillKey?: string | null;
  /** Notified when the user changes chart drill selection (for URL sync on the dashboard). */
  onDrillKeyChange?: (key: string | null) => void;
}) {
  const { title, report, savedReportConfig, onClose, initialDrillKey = null, onDrillKeyChange } = props;
  const dimension = report.config.dimension ?? "month";
  const [chartView, setChartView] = useState<ChartViewMode>(() =>
    chartViewFromConfig(report.config.chartType, dimension),
  );
  const tableRows = useMemo(() => tableRowsFromReport(report), [report]);
  const [drillKey, setDrillKey] = useState<string | null>(() => {
    const rows = tableRowsFromReport(report);
    return initialDrillKey && rows.some((r) => r.key === initialDrillKey) ? initialDrillKey : null;
  });
  const [insightQuestion, setInsightQuestion] = useState("");
  const [insightText, setInsightText] = useState<string | null>(null);
  const [insightRunSummary, setInsightRunSummary] = useState<ReportInsightRunSummary | null>(null);
  const [insightBusy, setInsightBusy] = useState(false);
  const [insightErr, setInsightErr] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const skippedChartReset = useRef(true);
  const prevUrlDrillRef = useRef<string | null>(null);

  const chartData = useMemo(() => seriesForChart(report), [report]);
  const colorByRowKey = useMemo(() => {
    const m = new Map<string, string>();
    chartData.forEach((p, i) => m.set(p.key, colorFor(i)));
    return m;
  }, [chartData]);

  useEffect(() => {
    const cur = initialDrillKey;
    if (cur && tableRows.some((r) => r.key === cur)) {
      setDrillKey(cur);
    } else if (prevUrlDrillRef.current && !cur) {
      setDrillKey(null);
    }
    prevUrlDrillRef.current = cur ?? null;
  }, [initialDrillKey, tableRows]);

  useEffect(() => {
    if (skippedChartReset.current) {
      skippedChartReset.current = false;
      return;
    }
    setDrillKey(null);
    onDrillKeyChange?.(null);
  }, [report.generatedAt, chartView, onDrillKeyChange]);

  const toggleDrill = useCallback(
    (key: string) => {
      setDrillKey((prev) => {
        const next = prev === key ? null : key;
        onDrillKeyChange?.(next);
        return next;
      });
    },
    [onDrillKeyChange],
  );

  useEffect(() => {
    if (!drillKey) return;
    const el = rowRefs.current.get(drillKey);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [drillKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fetchInsight = useCallback(async () => {
    if (!savedReportConfig || Object.keys(savedReportConfig).length === 0) {
      setInsightErr("No report configuration loaded for AI.");
      return;
    }
    setInsightBusy(true);
    setInsightErr(null);
    setInsightRunSummary(null);
    try {
      const res = await fetch("/api/control-tower/reports/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: savedReportConfig,
          question: insightQuestion.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        insight?: string;
        error?: string;
        runSummary?: ReportInsightRunSummary;
      };
      if (!res.ok) {
        setInsightText(null);
        setInsightRunSummary(data.runSummary ?? null);
        setInsightErr(data.error || res.statusText);
        return;
      }
      setInsightText(data.insight ?? "");
      setInsightRunSummary(data.runSummary ?? null);
    } catch (e) {
      setInsightErr(e instanceof Error ? e.message : "Insight failed.");
      setInsightText(null);
      setInsightRunSummary(null);
    } finally {
      setInsightBusy(false);
    }
  }, [savedReportConfig, insightQuestion]);

  const measureKey = report.config.measure;
  const drillRow = drillKey ? tableRows.find((r) => r.key === drillKey) : null;

  const onDownload = () => {
    downloadCsv(title, reportToCsv(report));
  };

  const dimLabel = dimensionLabel(dimension);
  const lineAllowed = dimension === "month";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ct-widget-modal-title"
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 pr-2">
            <h3 id="ct-widget-modal-title" className="text-lg font-semibold tracking-tight text-zinc-900">
              {title}
            </h3>
            <p className="mt-1 text-xs text-zinc-600">
              {metricLabel(measureKey)} · {dimLabel}
            </p>
            {report.runSummary?.dateWindowLine ? (
              <p className="mt-1 text-[11px] text-zinc-500">{report.runSummary.dateWindowLine}</p>
            ) : null}
            {report.runSummary?.compareMeasureLabel ? (
              <p className="mt-1 text-[11px] text-zinc-500">
                Compare: {report.runSummary.compareMeasureLabel}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50/80 p-0.5 text-xs shadow-sm">
              {(["bar", "line", "pie"] as const).map((v) => {
                const lineDisabled = v === "line" && !lineAllowed;
                return (
                  <button
                    key={v}
                    type="button"
                    disabled={lineDisabled}
                    title={
                      lineDisabled
                        ? "Line view is for month trends (time on the X-axis). Use bars or pie for categories."
                        : undefined
                    }
                    onClick={() => {
                      if (lineDisabled) return;
                      setChartView(v);
                    }}
                    className={`rounded-md px-2.5 py-1 capitalize transition ${
                      chartView === v
                        ? "bg-[var(--arscmp-primary)] font-medium text-white shadow-sm"
                        : lineDisabled
                          ? "cursor-not-allowed text-zinc-400"
                          : "text-zinc-700 hover:bg-white"
                    }`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onClose()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg leading-none text-zinc-600 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
            >
              ×
            </button>
          </div>
        </div>

        <CoverageSummary coverage={report.coverage} />

        <p className="mt-2 text-[11px] text-zinc-500">
          Tip: click a bar, point, or slice to highlight the row below (click again to clear). Click outside this panel
          or press Esc to close.
        </p>

        {chartView === "line" && lineAllowed ? (
          <p className="mt-2 rounded-lg border border-[var(--arscmp-primary)]/15 bg-[var(--arscmp-primary-50)]/90 px-3 py-2 text-[11px] text-zinc-800">
            One line = one measure over time: each point is a <strong>month</strong>, not a separate series. Switch to{" "}
            <strong>Bar</strong> to compare categories side by side.
          </p>
        ) : null}

        <div className="mt-3">
          {chartView === "bar" ? (
            <MiniBarChart
              data={chartData}
              height={280}
              measure={measureKey}
              variant="modal"
              xGroupLabel={dimLabel}
              selectedKey={drillKey}
              onBarSelect={toggleDrill}
            />
          ) : chartView === "line" ? (
            <MiniLineChart
              data={chartData}
              height={280}
              measure={measureKey}
              variant="modal"
              xGroupLabel={dimLabel}
              selectedKey={drillKey}
              onPointSelect={toggleDrill}
            />
          ) : (
            <MiniPieChart
              data={chartData}
              size={280}
              measure={measureKey}
              selectedKey={drillKey}
              onSliceSelect={toggleDrill}
            />
          )}
        </div>

        {drillRow ? (
          <div className="mt-3 rounded-lg border border-[var(--arscmp-primary)]/20 bg-[var(--arscmp-primary-50)]/80 px-3 py-2 text-xs text-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-[var(--arscmp-primary)]">Selected · {drillRow.label}</p>
              <WorkbenchDrillLink
                dimension={report.config.dimension}
                rowKey={drillRow.key}
                rowLabel={drillRow.label}
                ship360Tab={
                  report.config.measure === "onTimePct" ||
                  report.config.measure === "avgDelayDays" ||
                  report.config.dimension === "exceptionCatalog"
                    ? "milestones"
                    : undefined
                }
              />
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {CT_REPORT_MEASURES.map((m) => (
                <div key={m}>
                  <dt className="text-[10px] uppercase tracking-wide text-zinc-500">{metricLabel(m)}</dt>
                  <dd className="font-medium tabular-nums">{formatMetric(m, Number(drillRow.metrics[m] ?? 0))}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onDownload}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Download CSV (all rows)
          </button>
          <span className="text-xs text-zinc-500">
            {tableRows.length} row{tableRows.length === 1 ? "" : "s"} · {metricLabel(measureKey)} by {dimLabel}
          </span>
        </div>

        <div className="mt-3 max-h-56 overflow-auto rounded border border-zinc-200">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-zinc-100 text-zinc-700">
              <tr>
                <th className="border-b border-zinc-200 px-2 py-1.5 font-semibold">Color</th>
                <th className="border-b border-zinc-200 px-2 py-1.5 font-semibold">{dimensionLabel(report.config.dimension)}</th>
                {CT_REPORT_MEASURES.map((m) => (
                  <th key={m} className="border-b border-zinc-200 px-2 py-1.5 font-semibold">
                    {metricLabel(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr
                  key={r.key}
                  ref={(el) => {
                    if (el) rowRefs.current.set(r.key, el);
                    else rowRefs.current.delete(r.key);
                  }}
                  className={`odd:bg-white even:bg-zinc-50 ${
                    drillKey === r.key ? "bg-[var(--arscmp-primary-50)] ring-1 ring-inset ring-[var(--arscmp-primary)]/25" : ""
                  }`}
                >
                  <td className="border-b border-zinc-100 px-2 py-1">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded"
                      style={{ backgroundColor: colorByRowKey.get(r.key) ?? "#9ca3af" }}
                    />
                  </td>
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

        <div className="mt-4 rounded-lg border border-zinc-200/90 bg-gradient-to-br from-zinc-50 to-white p-3 shadow-sm">
          <p className="text-xs font-semibold text-zinc-900">Ask AI about this report</p>
          <p className="mt-0.5 text-[11px] text-zinc-600">
            Uses the same insight engine as the report builder (aggregated numbers only). Optional question:
          </p>
          <textarea
            className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-inner outline-none focus:border-[var(--arscmp-primary)] focus:ring-1 focus:ring-[var(--arscmp-primary)]/25"
            rows={2}
            placeholder="e.g. What stands out? Any concentration risk?"
            value={insightQuestion}
            onChange={(e) => setInsightQuestion(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void fetchInsight()}
            disabled={insightBusy}
            className="mt-2 rounded-lg bg-[var(--arscmp-primary)] px-3 py-1.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
          >
            {insightBusy ? "Generating…" : "Get AI insight"}
          </button>
          {insightErr ? <p className="mt-2 text-xs text-red-700">{insightErr}</p> : null}
          {insightRunSummary ? (
            <div className="mt-2 space-y-0.5 rounded-lg border border-zinc-200/90 bg-zinc-50/90 px-2.5 py-2 text-[11px] leading-snug text-zinc-800">
              {insightRunSummary.title ? (
                <p>
                  <span className="font-semibold">Report:</span> {insightRunSummary.title}
                </p>
              ) : null}
              <p>
                <span className="font-semibold">Scope:</span> {insightRunSummary.measureLabel} ·{" "}
                {insightRunSummary.dimensionLabel}
              </p>
              {insightRunSummary.dateWindowLine ? <p>{insightRunSummary.dateWindowLine}</p> : null}
              {insightRunSummary.compareMeasureLabel ? (
                <p>
                  <span className="font-semibold">Compare:</span> {insightRunSummary.compareMeasureLabel}
                </p>
              ) : null}
              <p className="text-zinc-700">
                <span className="font-semibold">Coverage:</span>{" "}
                {insightRunSummary.coverage.shipmentsAggregated} aggregated ·{" "}
                {insightRunSummary.coverage.totalShipmentsQueried} queried ·{" "}
                {insightRunSummary.coverage.excludedByDateOrMissingDateField} excluded (date / field)
              </p>
            </div>
          ) : null}
          {insightText ? (
            <div className="mt-2 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-inner">
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
      <span className="font-medium text-zinc-800">{formatInteger(coverage.shipmentsAggregated)}</span> shipments
      {coverage.excludedByDateOrMissingDateField > 0 ? (
        <>
          {" "}
          ·{" "}
          <span className="text-amber-800">
            {formatInteger(coverage.excludedByDateOrMissingDateField)} excluded (date missing / out of range)
          </span>
        </>
      ) : null}
    </p>
  );
}
