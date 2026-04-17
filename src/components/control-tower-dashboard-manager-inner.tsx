"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  ControlTowerDashboardWidgetModal,
  CoverageInline,
  MiniBarChart,
  colorFor,
  dimensionLabel,
  formatMetric,
  metricLabel,
  metricSummaryValue,
  seriesForCard,
  type CtDashboardWidgetReport,
} from "@/components/control-tower-dashboard-chart-kit";

type Widget = {
  id: string;
  title: string;
  sortOrder: number;
  layout: unknown;
  savedReport: { id: string; name: string; updatedAt: string; config: Record<string, unknown> };
  report: CtDashboardWidgetReport;
};

type Span = 1 | 2 | 3;

function getSpan(layout: unknown): Span {
  const obj = layout && typeof layout === "object" ? (layout as Record<string, unknown>) : {};
  const n = Number(obj.span);
  if (n === 2 || n === 3) return n;
  return 1;
}

export function ControlTowerDashboardManagerInner({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Widget | null>(null);

  const patchSearchParams = useCallback(
    (mut: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(searchParams.toString());
      mut(p);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

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

  const widgetParam = searchParams.get("widget");
  const drillParam = searchParams.get("drill");

  useEffect(() => {
    if (!widgets.length || expanded) return;
    if (!widgetParam) return;
    const w = widgets.find((x) => x.id === widgetParam);
    if (w) setExpanded(w);
  }, [widgets, widgetParam, expanded]);

  const persistOrder = useCallback(
    async (next: Widget[]) => {
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
    },
    [load],
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
        if (expanded?.id === id) {
          setExpanded(null);
          patchSearchParams((p) => {
            p.delete("widget");
            p.delete("drill");
          });
        }
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to remove widget.");
      } finally {
        setBusy(false);
      }
    },
    [expanded?.id, load, patchSearchParams],
  );

  const openWidget = useCallback(
    (w: Widget) => {
      setExpanded(w);
      patchSearchParams((p) => {
        p.set("widget", w.id);
        p.delete("drill");
      });
    },
    [patchSearchParams],
  );

  const closeModal = useCallback(() => {
    setExpanded(null);
    patchSearchParams((p) => {
      p.delete("widget");
      p.delete("drill");
    });
  }, [patchSearchParams]);

  const onModalDrillChange = useCallback(
    (key: string | null) => {
      if (!expanded) return;
      patchSearchParams((p) => {
        p.set("widget", expanded.id);
        if (key) p.set("drill", key);
        else p.delete("drill");
      });
    },
    [expanded, patchSearchParams],
  );

  const gridClass = useMemo(() => "grid gap-3 md:grid-cols-3", []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">My dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Arrange your pinned report widgets. Reorder and resize cards for your preferred operations view. Open a
            widget to copy the URL—chart drill selection is kept in <span className="font-medium">?drill=</span>.
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
          {widgets.map((w) => {
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
                  {metricLabel(w.report.config.measure)} · {dimensionLabel(w.report.config.dimension ?? "month")}
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-950">{metricSummaryValue(w.report)}</p>
                <CoverageInline coverage={w.report.coverage} />
                <button
                  type="button"
                  onClick={() => openWidget(w)}
                  className="mt-2 block w-full text-left"
                  title="Open chart, table, export, and AI"
                >
                  <MiniBarChart data={seriesForCard(w.report, 12)} height={72} measure={w.report.config.measure} />
                  <span className="mt-1 inline-block text-[11px] font-medium text-sky-800">
                    Click for chart, full data, CSV, AI
                  </span>
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
        <ControlTowerDashboardWidgetModal
          key={expanded.id}
          title={expanded.title}
          report={expanded.report}
          savedReportConfig={expanded.savedReport.config}
          onClose={closeModal}
          initialDrillKey={expanded.id === widgetParam ? drillParam : null}
          onDrillKeyChange={onModalDrillChange}
        />
      ) : null}
    </div>
  );
}
