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

function metricValue(widget: Widget): string {
  const m = widget.report.config.measure;
  const sum = widget.report.rows.reduce((acc, r) => acc + Number(r.metrics[m] ?? 0), 0);
  if (m === "onTimePct") return `${(sum / Math.max(widget.report.rows.length, 1)).toFixed(2)}%`;
  if (m === "shippingSpend") return `$${sum.toFixed(2)}`;
  return sum.toLocaleString();
}

export function ControlTowerDashboardWidgets({ canEdit }: { canEdit: boolean }) {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [err, setErr] = useState<string | null>(null);

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
            <ul className="mt-3 space-y-1 text-xs text-zinc-700">
              {w.report.rows.slice(0, 4).map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-2">
                  <span className="truncate">{r.label}</span>
                  <span className="font-medium">{Number(r.metrics[w.report.config.measure] ?? 0).toFixed(2)}</span>
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
    </section>
  );
}
