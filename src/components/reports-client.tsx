"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ReportListItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  params?: unknown;
};

export type BlockedReportRow = {
  id: string;
  title: string;
  category: string;
  missing: string;
};

type ReportColumn = {
  key: string;
  label: string;
  format?: string;
  align?: string;
};

type ReportResult = {
  reportId: string;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  generatedAt: string;
};

function cellDisplay(
  col: ReportColumn,
  value: string | number | null | undefined,
): string {
  if (value == null) return "—";
  if (col.format === "currency" && typeof value === "string") return value;
  if (col.format === "number") return String(value);
  return String(value);
}

function toCsv(columns: ReportColumn[], rows: Record<string, string | number | null>[]) {
  const header = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const raw = row[c.key];
        const s = raw == null ? "" : String(raw).replace(/"/g, '""');
        return `"${s}"`;
      })
      .join(","),
  );
  return [header, ...lines].join("\n");
}

function categoryLabel(c: string) {
  if (c === "orders") return "Orders";
  if (c === "logistics") return "Logistics";
  if (c === "planning") return "Planning";
  return c;
}

function parseNumericValue(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function ReportsClient({
  initialList,
  blockedReports = [],
  initialReportId,
  initialDrillRow = null,
}: {
  initialList: ReportListItem[];
  blockedReports?: BlockedReportRow[];
  /** When set and present in `initialList`, pre-select this report (e.g. from `?report=`). */
  initialReportId?: string | null;
  /** Optional `?row=` index into the result table after run (server pass-through). */
  initialDrillRow?: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [reports] = useState(initialList);
  const preferredId =
    initialReportId && initialList.some((r) => r.id === initialReportId) ? initialReportId : initialList[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState(preferredId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [chartRowIndex, setChartRowIndex] = useState<number | null>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  const rowFromUrl = searchParams.get("row");
  const parsedRowFromUrl =
    rowFromUrl !== null && /^\d+$/.test(rowFromUrl) ? Math.min(Number(rowFromUrl), 500_000) : null;

  const patchReportUrl = useCallback(
    (next: { reportId: string; row: number | null }) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("report", next.reportId);
      if (next.row !== null && Number.isFinite(next.row)) p.set("row", String(next.row));
      else p.delete("row");
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const selected = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? null,
    [reports, selectedId],
  );

  const chartModel = useMemo(() => {
    if (!result || result.rows.length === 0) return null;
    const numericColumn =
      result.columns.find((c) => c.format === "number" || c.format === "currency") ?? null;
    if (!numericColumn) return null;
    const labelColumn =
      result.columns.find((c) => c.key !== numericColumn.key && c.align !== "right") ??
      result.columns[0];
    const points = result.rows
      .map((row, rowIndex) => {
        const label = String(row[labelColumn.key] ?? "—");
        const value = parseNumericValue(row[numericColumn.key]);
        if (value == null) return null;
        return { rowIndex, label, value };
      })
      .filter((p): p is { rowIndex: number; label: string; value: number } => p !== null)
      .slice(0, 12);
    if (points.length === 0) return null;
    const max = Math.max(...points.map((p) => p.value), 1);
    return {
      points,
      max,
      label: labelColumn.label,
      metric: numericColumn.label,
    };
  }, [result]);

  useEffect(() => {
    if (!result) {
      setChartRowIndex(null);
      return;
    }
    const fromUrl = parsedRowFromUrl;
    const fromProp =
      initialDrillRow != null && initialDrillRow >= 0 && initialDrillRow < result.rows.length
        ? initialDrillRow
        : null;
    const pick = fromUrl != null && fromUrl >= 0 && fromUrl < result.rows.length ? fromUrl : fromProp;
    if (pick != null) {
      setChartRowIndex(pick);
    } else {
      setChartRowIndex(null);
    }
  }, [result?.generatedAt, parsedRowFromUrl, initialDrillRow, result]);

  useEffect(() => {
    if (chartRowIndex == null) return;
    rowRefs.current.get(chartRowIndex)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [chartRowIndex, result?.generatedAt]);

  const run = useCallback(async () => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/reports/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId: selectedId, params: {} }),
    });
    const payload = (await res.json()) as { result?: ReportResult; error?: string };
    setBusy(false);
    if (!res.ok) {
      setResult(null);
      setError(payload.error ?? "Report failed.");
      return;
    }
    if (payload.result) {
      setResult(payload.result);
      const p = new URLSearchParams(searchParams.toString());
      p.set("report", selectedId);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [pathname, router, searchParams, selectedId]);

  function downloadCsv() {
    if (!result) return;
    const csv = toCsv(result.columns, result.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.reportId}-${result.generatedAt.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const toggleHighlightRow = useCallback(
    (rowIndex: number) => {
      if (!selectedId) return;
      const next = chartRowIndex === rowIndex ? null : rowIndex;
      setChartRowIndex(next);
      patchReportUrl({ reportId: selectedId, row: next });
    },
    [chartRowIndex, patchReportUrl, selectedId],
  );

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Run a report</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Reports run against your tenant&apos;s live data. Export results as CSV for spreadsheets. After you run,
          click a chart bar or a table row to highlight it (any row index). The URL updates with{" "}
          <span className="font-medium">?row=</span> for sharing.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex min-w-[240px] flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">Report</span>
            {reports.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-600">
                No runnable reports — see unavailable list below or ask for role updates.
              </p>
            ) : (
              <select
                value={selectedId}
                onChange={(e) => {
                  const next = e.target.value;
                  setSelectedId(next);
                  setResult(null);
                  setError(null);
                  setChartRowIndex(null);
                  patchReportUrl({ reportId: next, row: null });
                }}
                className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900"
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            )}
          </label>
          <button
            type="button"
            disabled={busy || !selectedId || reports.length === 0}
            onClick={() => void run()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Running…" : "Run"}
          </button>
        </div>
        {selected && reports.length > 0 ? (
          <p className="mt-3 text-xs text-zinc-500">
            <span className="font-medium text-zinc-600">
              {categoryLabel(selected.category)}
            </span>
            {" · "}
            {selected.description}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-red-700">{error}</p>
        ) : null}
      </section>

      {result ? (
        <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-900">{result.title}</h3>
              <p className="text-xs text-zinc-500">
                Generated {new Date(result.generatedAt).toLocaleString()} · {result.rows.length}{" "}
                rows
              </p>
            </div>
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Download CSV
            </button>
          </div>
          {chartModel ? (
            <div className="border-b border-zinc-100 px-4 py-4">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900">Chart preview</h4>
                  <p className="text-xs text-zinc-500">
                    {chartModel.metric} by {chartModel.label} (top {chartModel.points.length} in chart) · click a bar
                    or use <span className="font-medium">?row=</span> for any table row
                  </p>
                </div>
                <p className="text-xs text-zinc-500">
                  Max: {chartModel.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="space-y-2">
                {chartModel.points.map((point) => {
                  const widthPct = Math.max(3, (point.value / chartModel.max) * 100);
                  const sel = chartRowIndex === point.rowIndex;
                  return (
                    <button
                      key={point.rowIndex}
                      type="button"
                      onClick={() => toggleHighlightRow(point.rowIndex)}
                      className={`grid w-full grid-cols-[180px_1fr_90px] items-center gap-2 rounded-md px-1 py-0.5 text-left outline-none ring-offset-2 hover:bg-violet-50/50 focus-visible:ring-2 focus-visible:ring-violet-400 ${
                        sel ? "bg-violet-50 ring-1 ring-violet-300" : ""
                      }`}
                      aria-pressed={sel}
                    >
                      <p className="truncate text-xs text-zinc-600" title={point.label}>
                        {point.label}
                      </p>
                      <div className="h-3 rounded-full bg-zinc-100">
                        <div
                          className="h-3 rounded-full bg-violet-500 transition-all duration-300"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <p className="text-right text-xs tabular-nums text-zinc-700">
                        {point.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  {result.columns.map((c) => (
                    <th
                      key={c.key}
                      className={`px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 ${
                        c.align === "right" ? "text-right" : ""
                      }`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {result.rows.map((row, i) => (
                  <tr
                    key={i}
                    ref={(el) => {
                      if (el) rowRefs.current.set(i, el);
                      else rowRefs.current.delete(i);
                    }}
                    onClick={() => toggleHighlightRow(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleHighlightRow(i);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={chartRowIndex === i}
                    className={`cursor-pointer outline-none hover:bg-zinc-50/80 focus-visible:ring-2 focus-visible:ring-violet-400 ${
                      chartRowIndex === i ? "bg-violet-50 ring-1 ring-inset ring-violet-200" : ""
                    }`}
                  >
                    {result.columns.map((c) => (
                      <td
                        key={c.key}
                        className={`whitespace-nowrap px-4 py-2 text-zinc-800 ${
                          c.align === "right" ? "text-right tabular-nums" : ""
                        }`}
                      >
                        {cellDisplay(c, row[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {blockedReports.length > 0 ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Unavailable reports</h2>
          <p className="mt-1 text-sm text-zinc-600">
            These are registered in the product but your role is missing a required global
            permission. An administrator can grant it under Settings → Roles → Permissions.
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-100">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Report
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Area
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Missing permission
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {blockedReports.map((r) => (
                  <tr key={r.id} className="text-zinc-800">
                    <td className="px-4 py-2 font-medium">{r.title}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-600">
                      {categoryLabel(r.category)}
                    </td>
                    <td className="px-4 py-2">
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">
                        {r.missing}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
