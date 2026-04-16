"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { WorkbenchDrillLink } from "@/components/workbench-drill-link";

type Measure = "shipments" | "volumeCbm" | "weightKg" | "shippingSpend" | "onTimePct" | "avgDelayDays";
type Dimension =
  | "none"
  | "status"
  | "mode"
  | "lane"
  | "carrier"
  | "customer"
  | "supplier"
  | "origin"
  | "destination"
  | "month";
type ChartType = "table" | "bar" | "line" | "pie";

type ReportConfig = {
  title?: string;
  chartType: ChartType;
  dimension: Dimension;
  measure: Measure;
  compareMeasure: Measure | null;
  comparePeriod: "none" | "prev_period" | "prev_year";
  dateField: "shippedAt" | "receivedAt" | "bookingEta";
  dateFrom: string;
  dateTo: string;
  topN: number;
  filters: {
    status: string;
    mode: string;
    lane: string;
    carrier: string;
    customer: string;
    supplier: string;
    origin: string;
    destination: string;
  };
};

type RunResult = {
  config: {
    title?: string;
    chartType: ChartType;
    dimension: Dimension;
    measure: Measure;
    compareMeasure: Measure | null;
    dateField: "shippedAt" | "receivedAt" | "bookingEta";
    topN: number;
  };
  rows: Array<{ key: string; label: string; metrics: Record<Measure, number> }>;
  totals: Record<Measure, number>;
  generatedAt: string;
};

type SavedReport = {
  id: string;
  name: string;
  description: string | null;
  isShared: boolean;
  owner: { id: string; name: string };
  config: unknown;
  createdAt: string;
  updatedAt: string;
};

const MEASURE_LABELS: Record<Measure, string> = {
  shipments: "Shipments",
  volumeCbm: "Volume (cbm)",
  weightKg: "Weight (kg)",
  shippingSpend: "Shipping spend",
  onTimePct: "On-time %",
  avgDelayDays: "Avg delay (days)",
};

const DEFAULT_CONFIG: ReportConfig = {
  title: "New report",
  chartType: "bar",
  dimension: "month",
  measure: "shipments",
  compareMeasure: null,
  comparePeriod: "none",
  dateField: "shippedAt",
  dateFrom: "",
  dateTo: "",
  topN: 12,
  filters: {
    status: "",
    mode: "",
    lane: "",
    carrier: "",
    customer: "",
    supplier: "",
    origin: "",
    destination: "",
  },
};

function hydrateConfig(input: unknown): ReportConfig {
  const o = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const filters = o.filters && typeof o.filters === "object" ? (o.filters as Record<string, unknown>) : {};
  return {
    ...DEFAULT_CONFIG,
    title: typeof o.title === "string" ? o.title : DEFAULT_CONFIG.title,
    chartType:
      o.chartType === "table" || o.chartType === "bar" || o.chartType === "line" || o.chartType === "pie"
        ? o.chartType
        : DEFAULT_CONFIG.chartType,
    dimension: typeof o.dimension === "string" ? (o.dimension as Dimension) : DEFAULT_CONFIG.dimension,
    measure: typeof o.measure === "string" ? (o.measure as Measure) : DEFAULT_CONFIG.measure,
    compareMeasure: typeof o.compareMeasure === "string" ? (o.compareMeasure as Measure) : null,
    comparePeriod:
      o.comparePeriod === "prev_period" || o.comparePeriod === "prev_year"
        ? o.comparePeriod
        : "none",
    dateField:
      o.dateField === "receivedAt" || o.dateField === "bookingEta" || o.dateField === "shippedAt"
        ? o.dateField
        : DEFAULT_CONFIG.dateField,
    dateFrom: typeof o.dateFrom === "string" ? o.dateFrom : "",
    dateTo: typeof o.dateTo === "string" ? o.dateTo : "",
    topN: typeof o.topN === "number" ? o.topN : DEFAULT_CONFIG.topN,
    filters: {
      status: typeof filters.status === "string" ? filters.status : "",
      mode: typeof filters.mode === "string" ? filters.mode : "",
      lane: typeof filters.lane === "string" ? filters.lane : "",
      carrier: typeof filters.carrier === "string" ? filters.carrier : "",
      customer: typeof filters.customer === "string" ? filters.customer : "",
      supplier: typeof filters.supplier === "string" ? filters.supplier : "",
      origin: typeof filters.origin === "string" ? filters.origin : "",
      destination: typeof filters.destination === "string" ? filters.destination : "",
    },
  };
}

function shiftDateIso(iso: string, byDays: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + byDays);
  return d.toISOString().slice(0, 10);
}

function compareRange(config: ReportConfig): { from: string; to: string } | null {
  if (!config.dateFrom || !config.dateTo || config.comparePeriod === "none") return null;
  if (config.comparePeriod === "prev_year") {
    const from = new Date(`${config.dateFrom}T00:00:00.000Z`);
    const to = new Date(`${config.dateTo}T00:00:00.000Z`);
    from.setUTCFullYear(from.getUTCFullYear() - 1);
    to.setUTCFullYear(to.getUTCFullYear() - 1);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }
  const fromMs = new Date(`${config.dateFrom}T00:00:00.000Z`).getTime();
  const toMs = new Date(`${config.dateTo}T00:00:00.000Z`).getTime();
  const spanDays = Math.max(1, Math.round((toMs - fromMs) / 86400000) + 1);
  return {
    from: shiftDateIso(config.dateFrom, -spanDays),
    to: shiftDateIso(config.dateTo, -spanDays),
  };
}

function toRunPayload(config: ReportConfig) {
  return {
    ...config,
    dateFrom: config.dateFrom || null,
    dateTo: config.dateTo || null,
    filters: Object.fromEntries(
      Object.entries(config.filters).map(([k, v]) => [k, v.trim() || null]),
    ),
  };
}

function formatMetric(measure: Measure, value: number): string {
  if (measure === "onTimePct") return `${value.toFixed(2)}%`;
  if (measure === "shippingSpend") return `$${value.toFixed(2)}`;
  if (measure === "avgDelayDays") return `${value.toFixed(2)}d`;
  return value.toLocaleString();
}

function ResultLineChart({
  rows,
  measure,
  compareByKey,
  compareEnabled,
  selectedKey,
  onPointSelect,
}: {
  rows: Array<{ key: string; label: string; metrics: Record<Measure, number> }>;
  measure: Measure;
  compareByKey: Map<string, number>;
  compareEnabled: boolean;
  selectedKey?: string | null;
  onPointSelect?: (key: string) => void;
}) {
  const interactive = Boolean(onPointSelect);
  const values = rows.map((r) => Number(r.metrics[measure] ?? 0));
  const compareValues = rows.map((r) => Number(compareByKey.get(r.key) ?? 0));
  const max = Math.max(1, ...values, ...(compareEnabled ? compareValues : []));
  const w = 700;
  const h = 220;
  const p = 24;
  const step = rows.length > 1 ? (w - p * 2) / (rows.length - 1) : 0;
  const y = (v: number) => h - p - (v / max) * (h - p * 2);
  const currentPoints = rows.map((r, i) => `${p + i * step},${y(Number(r.metrics[measure] ?? 0))}`).join(" ");
  const comparePoints = rows.map((r, i) => `${p + i * step},${y(Number(compareByKey.get(r.key) ?? 0))}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-56 w-full rounded border border-zinc-200 bg-white"
      role={interactive ? "img" : undefined}
      aria-label={interactive ? "Line chart; click a point to highlight the row in the table below." : undefined}
    >
      <line x1={p} y1={h - p} x2={w - p} y2={h - p} stroke="#d4d4d8" />
      <line x1={p} y1={p} x2={p} y2={h - p} stroke="#d4d4d8" />
      {compareEnabled ? (
        <polyline fill="none" stroke="#8b5cf6" strokeWidth="2" points={comparePoints} pointerEvents="none" />
      ) : null}
      <polyline fill="none" stroke="#0ea5e9" strokeWidth="2.5" points={currentPoints} pointerEvents="none" />
      {interactive
        ? rows.map((r, i) => {
            const cx = p + i * step;
            const cy = y(Number(r.metrics[measure] ?? 0));
            const sel = selectedKey === r.key;
            return (
              <g key={r.key}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={16}
                  fill="transparent"
                  className="cursor-pointer"
                  tabIndex={0}
                  role="button"
                  aria-label={`${r.label}: ${formatMetric(measure, Number(r.metrics[measure] ?? 0))}${sel ? ", selected" : ""}`}
                  aria-pressed={sel}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPointSelect?.(r.key);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPointSelect?.(r.key);
                    }
                  }}
                >
                  <title>{`${r.label}: ${formatMetric(measure, Number(r.metrics[measure] ?? 0))}`}</title>
                </circle>
                <circle
                  cx={cx}
                  cy={cy}
                  r={sel ? 7 : 5}
                  fill="#fff"
                  stroke={sel ? "#0c4a6e" : "#0ea5e9"}
                  strokeWidth={sel ? 3 : 2}
                  pointerEvents="none"
                />
              </g>
            );
          })
        : null}
    </svg>
  );
}

function ResultPieChart({
  rows,
  measure,
  selectedKey,
  onSliceSelect,
}: {
  rows: Array<{ key: string; label: string; metrics: Record<Measure, number> }>;
  measure: Measure;
  selectedKey?: string | null;
  onSliceSelect?: (key: string) => void;
}) {
  const interactive = Boolean(onSliceSelect);
  const colors = ["#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#f97316"];
  const entries = rows.slice(0, 8).map((r, i) => ({
    key: r.key,
    label: r.label,
    value: Math.max(0, Number(r.metrics[measure] ?? 0)),
    color: colors[i % colors.length],
  }));
  const total = entries.reduce((a, b) => a + b.value, 0);
  if (total <= 0) return <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-4 text-xs text-zinc-500">No chart data</div>;
  const cumulative = entries.reduce<number[]>((acc, e, idx) => {
    const prev = idx === 0 ? 0 : acc[idx - 1]!;
    acc.push(prev + e.value);
    return acc;
  }, []);
  const gradientParts = entries.map((e, idx) => {
    const start = (idx === 0 ? 0 : cumulative[idx - 1]!) / total;
    const end = cumulative[idx]! / total;
    return `${e.color} ${start * 100}% ${end * 100}%`;
  });
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div
        className="h-40 w-40 shrink-0 rounded-full border border-zinc-200"
        style={{ background: `conic-gradient(${gradientParts.join(", ")})` }}
        aria-hidden
      />
      <ul className="min-w-0 flex-1 space-y-1 text-xs text-zinc-700">
        {entries.map((e) => {
          const sel = selectedKey === e.key;
          return (
            <li key={e.key}>
              {interactive ? (
                <button
                  type="button"
                  onClick={() => onSliceSelect?.(e.key)}
                  className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-zinc-100 ${
                    sel ? "bg-sky-50 ring-1 ring-sky-300" : ""
                  }`}
                >
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded" style={{ backgroundColor: e.color }} />
                  <span className="min-w-0 truncate">{e.label}</span>
                  <span className="ml-auto shrink-0 font-medium">{formatMetric(measure, e.value)}</span>
                </button>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded" style={{ backgroundColor: e.color }} />
                  <span>{e.label}</span>
                  <span className="font-medium">{formatMetric(measure, e.value)}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ControlTowerReportBuilder({ canEdit }: { canEdit: boolean }) {
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_CONFIG);
  const [result, setResult] = useState<RunResult | null>(null);
  const [compareResult, setCompareResult] = useState<RunResult | null>(null);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [meUserId, setMeUserId] = useState<string | null>(null);
  const [saveAsShared, setSaveAsShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [insightQuestion, setInsightQuestion] = useState("");
  const [insightText, setInsightText] = useState<string | null>(null);
  const [insightBusy, setInsightBusy] = useState(false);
  const [insightErr, setInsightErr] = useState<string | null>(null);
  const [chartDrillKey, setChartDrillKey] = useState<string | null>(null);
  const resultRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const toggleChartDrill = useCallback((key: string) => {
    setChartDrillKey((prev) => (prev === key ? null : key));
  }, []);

  useEffect(() => {
    setChartDrillKey(null);
  }, [result?.generatedAt]);

  useEffect(() => {
    if (!chartDrillKey) return;
    resultRowRefs.current.get(chartDrillKey)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [chartDrillKey]);

  const loadSaved = useCallback(async () => {
    const res = await fetch("/api/control-tower/reports/saved?dataset=CONTROL_TOWER");
    if (!res.ok) return;
    const json = (await res.json()) as { reports?: SavedReport[]; meUserId?: string };
    setMeUserId(typeof json.meUserId === "string" ? json.meUserId : null);
    setSaved(json.reports ?? []);
  }, []);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const run = useCallback(async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    setInsightText(null);
    setInsightErr(null);
    try {
      const res = await fetch("/api/control-tower/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: toRunPayload(config) }),
      });
      const data = (await res.json()) as RunResult & { error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setResult(data);

      const shifted = compareRange(config);
      if (shifted) {
        const compareRes = await fetch("/api/control-tower/reports/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config: toRunPayload({
              ...config,
              dateFrom: shifted.from,
              dateTo: shifted.to,
              comparePeriod: "none",
            }),
          }),
        });
        const compareData = (await compareRes.json()) as RunResult & { error?: string };
        if (compareRes.ok) setCompareResult(compareData);
        else setCompareResult(null);
      } else {
        setCompareResult(null);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Report run failed.");
      setCompareResult(null);
    } finally {
      setBusy(false);
    }
  }, [config]);

  const fetchInsight = useCallback(async () => {
    setInsightBusy(true);
    setInsightErr(null);
    try {
      const res = await fetch("/api/control-tower/reports/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: toRunPayload(config),
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
  }, [config, insightQuestion]);

  const saveReport = useCallback(async () => {
    if (!canEdit) return;
    const name = window.prompt("Report name:", config.title || "New report");
    if (!name?.trim()) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/control-tower/reports/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: "",
          config: toRunPayload({ ...config, title: name.trim() }),
          isShared: saveAsShared,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setMsg("Report saved.");
      await loadSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [canEdit, config, loadSaved, saveAsShared]);

  const toggleShare = useCallback(
    async (report: SavedReport) => {
      if (!canEdit) return;
      setBusy(true);
      setErr(null);
      setMsg(null);
      try {
        const res = await fetch(`/api/control-tower/reports/saved/${report.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isShared: !report.isShared }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error || res.statusText);
        setMsg(!report.isShared ? "Report is now shared." : "Report is now private.");
        await loadSaved();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Share toggle failed.");
      } finally {
        setBusy(false);
      }
    },
    [canEdit, loadSaved],
  );

  const pinReport = useCallback(async (savedReportId: string, title: string) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/control-tower/dashboard/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedReportId, title }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setMsg("Pinned to dashboard.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Pin failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  const compareByKey = useMemo(() => {
    const m = new Map<string, number>();
    if (!compareResult) return m;
    const measure = result?.config.measure ?? compareResult.config.measure;
    for (const row of compareResult.rows) {
      m.set(row.key, Number(row.metrics[measure] ?? 0));
    }
    return m;
  }, [compareResult, result]);
  const compareMaxVal = useMemo(() => {
    if (!result) return 0;
    let max = 0;
    for (const row of result.rows) {
      const current = Number(row.metrics[result.config.measure] ?? 0);
      const previous = Number(compareByKey.get(row.key) ?? 0);
      max = Math.max(max, current, previous);
    }
    return max;
  }, [compareByKey, result]);

  const comparisonLine = useMemo(() => {
    if (!result || !compareResult) return null;
    const m = result.config.measure;
    const current = result.rows.reduce((acc, r) => acc + Number(r.metrics[m] ?? 0), 0);
    const previous = compareResult.rows.reduce((acc, r) => acc + Number(r.metrics[m] ?? 0), 0);
    const delta = current - previous;
    const deltaPct = previous !== 0 ? (delta / previous) * 100 : null;
    return { current, previous, delta, deltaPct, measure: m };
  }, [result, compareResult]);

  const chartDrillRow = useMemo(() => {
    if (!result || !chartDrillKey) return null;
    return result.rows.find((r) => r.key === chartDrillKey) ?? null;
  }, [result, chartDrillKey]);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">Report builder</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            className="rounded border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Running…" : "Run"}
          </button>
          {canEdit ? (
            <button
              type="button"
              onClick={() => void saveReport()}
              disabled={busy}
              className="rounded border border-sky-600 px-3 py-1.5 text-sm font-medium text-sky-900 disabled:opacity-50"
            >
              Save
            </button>
          ) : null}
          {canEdit ? (
            <label className="ml-1 flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={saveAsShared}
                onChange={(e) => setSaveAsShared(e.target.checked)}
              />
              Save as shared
            </label>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <button
          type="button"
          className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800"
          onClick={() =>
            setConfig((c) => ({
              ...c,
              title: "Volume by lane",
              chartType: "bar",
              dimension: "lane",
              measure: "volumeCbm",
            }))
          }
        >
          Preset: Volume by lane
        </button>
        <button
          type="button"
          className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800"
          onClick={() =>
            setConfig((c) => ({
              ...c,
              title: "Spend by carrier",
              chartType: "bar",
              dimension: "carrier",
              measure: "shippingSpend",
            }))
          }
        >
          Preset: Spend by carrier
        </button>
        <button
          type="button"
          className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800"
          onClick={() =>
            setConfig((c) => ({
              ...c,
              title: "On-time by lane",
              chartType: "bar",
              dimension: "lane",
              measure: "onTimePct",
              dateField: "receivedAt",
            }))
          }
        >
          Preset: On-time by lane
        </button>
        <button
          type="button"
          className="rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800"
          onClick={() =>
            setConfig((c) => ({
              ...c,
              title: "Shipments trend",
              chartType: "line",
              dimension: "month",
              measure: "shipments",
            }))
          }
        >
          Preset: Monthly trend
        </button>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-4">
        <label className="text-xs text-zinc-700">
          Title
          <input
            value={config.title || ""}
            onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-zinc-700">
          Chart
          <select
            value={config.chartType}
            onChange={(e) => setConfig((c) => ({ ...c, chartType: e.target.value as ChartType }))}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
            <option value="table">Table</option>
          </select>
        </label>
        <label className="text-xs text-zinc-700">
          Group by
          <select
            value={config.dimension}
            onChange={(e) => setConfig((c) => ({ ...c, dimension: e.target.value as Dimension }))}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            {["month", "lane", "carrier", "customer", "supplier", "status", "mode", "origin", "destination", "none"].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-700">
          Measure
          <select
            value={config.measure}
            onChange={(e) => setConfig((c) => ({ ...c, measure: e.target.value as Measure }))}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            {Object.entries(MEASURE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-700">
          Compare period
          <select
            value={config.comparePeriod}
            onChange={(e) =>
              setConfig((c) => ({ ...c, comparePeriod: e.target.value as ReportConfig["comparePeriod"] }))
            }
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="none">None</option>
            <option value="prev_period">Previous period</option>
            <option value="prev_year">Same period last year</option>
          </select>
        </label>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-6">
        <label className="text-xs text-zinc-700">Status<input value={config.filters.status} onChange={(e)=>setConfig(c=>({...c,filters:{...c.filters,status:e.target.value}}))} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"/></label>
        <label className="text-xs text-zinc-700">Mode<input value={config.filters.mode} onChange={(e)=>setConfig(c=>({...c,filters:{...c.filters,mode:e.target.value}}))} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"/></label>
        <label className="text-xs text-zinc-700">Lane<input value={config.filters.lane} onChange={(e)=>setConfig(c=>({...c,filters:{...c.filters,lane:e.target.value}}))} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"/></label>
        <label className="text-xs text-zinc-700">Carrier<input value={config.filters.carrier} onChange={(e)=>setConfig(c=>({...c,filters:{...c.filters,carrier:e.target.value}}))} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"/></label>
        <label className="text-xs text-zinc-700">Customer<input value={config.filters.customer} onChange={(e)=>setConfig(c=>({...c,filters:{...c.filters,customer:e.target.value}}))} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"/></label>
        <label className="text-xs text-zinc-700">Supplier<input value={config.filters.supplier} onChange={(e)=>setConfig(c=>({...c,filters:{...c.filters,supplier:e.target.value}}))} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"/></label>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-5">
        <label className="text-xs text-zinc-700">Date field
          <select value={config.dateField} onChange={(e)=>setConfig(c=>({...c,dateField:e.target.value as ReportConfig["dateField"]}))} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm">
            <option value="shippedAt">Shipped</option>
            <option value="receivedAt">Received</option>
            <option value="bookingEta">Booking ETA</option>
          </select>
        </label>
        <label className="text-xs text-zinc-700">From<input type="date" value={config.dateFrom} onChange={(e)=>setConfig(c=>({...c,dateFrom:e.target.value}))} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"/></label>
        <label className="text-xs text-zinc-700">To<input type="date" value={config.dateTo} onChange={(e)=>setConfig(c=>({...c,dateTo:e.target.value}))} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"/></label>
        <label className="text-xs text-zinc-700">
          Top N
          <select
            value={String(config.topN)}
            onChange={(e) => setConfig((c) => ({ ...c, topN: Number(e.target.value) }))}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="5">Top 5</option>
            <option value="10">Top 10</option>
            <option value="20">Top 20</option>
            <option value="50">Top 50</option>
          </select>
        </label>
      </div>

      {msg ? <p className="mt-2 text-xs text-emerald-700">{msg}</p> : null}
      {err ? <p className="mt-2 text-xs text-red-700">{err}</p> : null}

      {result ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-zinc-500">
            Generated {new Date(result.generatedAt).toLocaleString()} · {result.rows.length} rows
          </p>
          {comparisonLine ? (
            <p className="text-xs text-zinc-700">
              Compare ({config.comparePeriod}): current{" "}
              <strong>{formatMetric(comparisonLine.measure, comparisonLine.current)}</strong> vs previous{" "}
              <strong>{formatMetric(comparisonLine.measure, comparisonLine.previous)}</strong> · delta{" "}
              <strong className={comparisonLine.delta >= 0 ? "text-emerald-700" : "text-rose-700"}>
                {comparisonLine.delta >= 0 ? "+" : ""}
                {comparisonLine.deltaPct != null
                  ? `${comparisonLine.deltaPct.toFixed(2)}%`
                  : formatMetric(comparisonLine.measure, comparisonLine.delta)}
              </strong>
            </p>
          ) : null}
          {result.config.chartType === "table" ? null : (
            <div className="space-y-2">
              <p className="text-[11px] text-zinc-500">
                Click the chart (bar, point, or legend row) to highlight that dimension in the table below; click again
                to clear.
              </p>
              {compareResult ? (
                <div className="mb-1 flex items-center gap-3 text-[11px] text-zinc-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded bg-sky-500" />
                    Current
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded bg-violet-500" />
                    Compare
                  </span>
                </div>
              ) : null}
              {result.config.chartType === "line" ? (
                <ResultLineChart
                  rows={result.rows}
                  measure={result.config.measure}
                  compareByKey={compareByKey}
                  compareEnabled={Boolean(compareResult)}
                  selectedKey={chartDrillKey}
                  onPointSelect={toggleChartDrill}
                />
              ) : null}
              {result.config.chartType === "pie" ? (
                <ResultPieChart
                  rows={result.rows}
                  measure={result.config.measure}
                  selectedKey={chartDrillKey}
                  onSliceSelect={toggleChartDrill}
                />
              ) : null}
              {result.config.chartType === "bar"
                ? result.rows.map((row) => {
                    const val = row.metrics[result.config.measure] ?? 0;
                    const prevVal = Number(compareByKey.get(row.key) ?? 0);
                    const width = compareMaxVal > 0 ? Math.max(4, Math.round((val / compareMaxVal) * 100)) : 4;
                    const prevWidth =
                      compareResult && compareMaxVal > 0
                        ? Math.max(4, Math.round((prevVal / compareMaxVal) * 100))
                        : 0;
                    const sel = chartDrillKey === row.key;
                    return (
                      <div key={row.key} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => toggleChartDrill(row.key)}
                          className={`w-full rounded px-1 text-left outline-none ring-offset-2 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-sky-400 ${
                            sel ? "bg-sky-50 ring-1 ring-sky-300" : ""
                          }`}
                          aria-pressed={sel}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate text-zinc-700">{row.label}</span>
                            <span className="font-medium text-zinc-900">{formatMetric(result.config.measure, val)}</span>
                          </div>
                          <div className="mt-1 space-y-1">
                            <div className="h-2 rounded bg-zinc-100">
                              <div className="h-2 rounded bg-sky-500" style={{ width: `${width}%` }} />
                            </div>
                            {compareResult ? (
                              <div className="h-2 rounded bg-zinc-100">
                                <div className="h-2 rounded bg-violet-500" style={{ width: `${prevWidth}%` }} />
                              </div>
                            ) : null}
                          </div>
                        </button>
                      </div>
                    );
                  })
                : null}
            </div>
          )}

          {chartDrillRow ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-100 bg-sky-50/60 px-3 py-2 text-xs text-zinc-700">
              <span className="font-medium text-sky-950">Drill-down</span>
              <WorkbenchDrillLink
                dimension={result.config.dimension}
                rowKey={chartDrillRow.key}
                rowLabel={chartDrillRow.label}
              />
            </div>
          ) : null}

          <div className="overflow-x-auto rounded border border-zinc-200">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-100 text-left text-xs uppercase text-zinc-700">
                <tr>
                  <th className="px-2 py-2">{result.config.dimension}</th>
                  <th className="px-2 py-2">{MEASURE_LABELS[result.config.measure]}</th>
                  {compareResult ? <th className="px-2 py-2">Compare</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {result.rows.map((row) => (
                  <tr
                    key={row.key}
                    ref={(el) => {
                      if (el) resultRowRefs.current.set(row.key, el);
                      else resultRowRefs.current.delete(row.key);
                    }}
                    className={chartDrillKey === row.key ? "bg-sky-50 ring-1 ring-inset ring-sky-200" : ""}
                  >
                    <td className="px-2 py-2 text-zinc-800">{row.label}</td>
                    <td className="px-2 py-2 font-medium text-zinc-900">
                      {formatMetric(result.config.measure, row.metrics[result.config.measure] ?? 0)}
                    </td>
                    {compareResult ? (
                      <td className="px-2 py-2 text-zinc-700">
                        {formatMetric(result.config.measure, Number(compareByKey.get(row.key) ?? 0))}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-violet-200 bg-violet-50/80 p-3">
            <p className="text-xs font-semibold text-violet-950">Optional AI insight</p>
            <p className="mt-1 text-[11px] text-violet-900/80">
              Runs the same report on the server and asks the model to interpret aggregated numbers only. Add
              CONTROL_TOWER_REPORT_INSIGHT_LLM=1 and OPENAI_API_KEY on the server.
            </p>
            <label className="mt-2 block text-xs text-violet-950">
              Focus question (optional)
              <input
                value={insightQuestion}
                onChange={(e) => setInsightQuestion(e.target.value)}
                placeholder="e.g. Which carrier should we watch? Any concentration risk?"
                className="mt-1 w-full rounded border border-violet-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
              />
            </label>
            <button
              type="button"
              disabled={insightBusy}
              onClick={() => void fetchInsight()}
              className="mt-2 rounded border border-violet-700 bg-violet-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {insightBusy ? "Generating…" : "Get AI insight"}
            </button>
            {insightErr ? <p className="mt-2 text-xs text-red-700">{insightErr}</p> : null}
            {insightText ? (
              <div className="mt-3 whitespace-pre-wrap rounded border border-violet-100 bg-white p-3 text-sm text-zinc-900">
                {insightText}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {saved.length > 0 ? (
        <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-semibold uppercase text-zinc-600">Saved reports</p>
          <ul className="mt-2 space-y-2">
            {saved.slice(0, 20).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white px-2 py-1.5">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {r.name}{" "}
                    <span className={`text-xs ${r.isShared ? "text-emerald-700" : "text-zinc-500"}`}>
                      {r.isShared ? "· Shared" : "· Private"}
                    </span>
                  </p>
                  <p className="text-xs text-zinc-500">Owner: {r.owner.name}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig(hydrateConfig(r.config))}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-800"
                  >
                    Load
                  </button>
                  {canEdit ? (
                    meUserId === r.owner.id ? (
                      <button
                        type="button"
                        onClick={() => void toggleShare(r)}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-800"
                      >
                        {r.isShared ? "Make private" : "Share"}
                      </button>
                    ) : null
                  ) : null}
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => void pinReport(r.id, r.name)}
                      className="rounded border border-sky-400 px-2 py-1 text-xs text-sky-900"
                    >
                      Pin to dashboard
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
