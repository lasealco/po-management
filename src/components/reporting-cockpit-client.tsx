"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { ReportingCockpitSnapshot } from "@/lib/reporting/cockpit-types";

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

function severityClass(level: "high" | "medium") {
  return level === "high"
    ? "border-rose-300 bg-rose-50 text-rose-900"
    : "border-amber-300 bg-amber-50 text-amber-900";
}

export function ReportingCockpitClient({
  canPo,
  canCt,
  canCrm,
  canWms,
}: {
  canPo: boolean;
  canCt: boolean;
  canCrm: boolean;
  canWms: boolean;
}) {
  const [snapshot, setSnapshot] = useState<ReportingCockpitSnapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightErr, setInsightErr] = useState<string | null>(null);
  const [insightBusy, setInsightBusy] = useState(false);
  const [question, setQuestion] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/reporting/cockpit");
      const data = (await res.json()) as { snapshot?: ReportingCockpitSnapshot; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setSnapshot(data.snapshot ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load cockpit.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const askAi = useCallback(async () => {
    setInsightBusy(true);
    setInsightErr(null);
    try {
      const res = await fetch("/api/reporting/cockpit/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() || undefined }),
      });
      const data = (await res.json()) as { insight?: string; error?: string };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setInsight(data.insight ?? "");
    } catch (e) {
      setInsightErr(e instanceof Error ? e.message : "Insight failed.");
      setInsight(null);
    } finally {
      setInsightBusy(false);
    }
  }, [question]);

  const totalCashCycle = useMemo(
    () => (snapshot ? snapshot.cashCycle.reduce((sum, c) => sum + c.amount, 0) : 0),
    [snapshot],
  );

  if (busy && !snapshot) {
    return <p className="rounded-xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600">Loading cockpit…</p>;
  }
  if (err && !snapshot) {
    return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{err}</p>;
  }
  if (!snapshot) return null;

  return (
    <section className="mb-8 space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-zinc-900 via-slate-900 to-violet-900 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-200">Executive Cockpit</p>
            <h2 className="mt-1 text-2xl font-semibold">Cross-Module Pulse</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-200">
              Exceptions + cash-cycle flow across PO, Control Tower, CRM, and WMS in one premium command view.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
          >
            Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2">
            <p className="text-xs text-sky-100">Open POs</p>
            <p className="mt-1 text-xl font-semibold">{formatNumber(snapshot.summary.openPoCount)}</p>
          </div>
          <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2">
            <p className="text-xs text-sky-100">In-transit shipments</p>
            <p className="mt-1 text-xl font-semibold">{formatNumber(snapshot.summary.inTransitShipmentCount)}</p>
          </div>
          <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2">
            <p className="text-xs text-sky-100">Open logistics exceptions</p>
            <p className="mt-1 text-xl font-semibold">{formatNumber(snapshot.summary.openCtExceptionCount)}</p>
          </div>
          <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2">
            <p className="text-xs text-sky-100">Active CRM opportunities</p>
            <p className="mt-1 text-xl font-semibold">{formatNumber(snapshot.summary.activeOpportunityCount)}</p>
          </div>
          <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2">
            <p className="text-xs text-sky-100">Inventory on hold qty</p>
            <p className="mt-1 text-xl font-semibold">{formatNumber(snapshot.summary.onHoldInventoryQty, 0)}</p>
          </div>
          <div className="rounded-lg border border-emerald-300/50 bg-emerald-500/20 px-3 py-2">
            <p className="text-xs text-emerald-100">WMS uninvoiced billable</p>
            <p className="mt-1 text-xl font-semibold">
              {formatMoney(snapshot.summary.uninvoicedBillingAmount, snapshot.currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-zinc-900">Unified Exceptions Wall</h3>
            <span className="text-xs text-zinc-500">Prioritized risks</span>
          </div>
          <ul className="space-y-2">
            {snapshot.exceptions.map((x) => (
              <li key={x.id} className={`rounded-lg border px-3 py-2 ${severityClass(x.severity)}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{x.label}</p>
                    <p className="text-xs opacity-80">{x.severity === "high" ? "High priority" : "Watchlist"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatNumber(x.count)}</p>
                    <Link className="text-xs underline" href={x.href}>
                      Open
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-zinc-900">Cash Cycle Signal</h3>
            <span className="text-xs text-zinc-500">{formatMoney(totalCashCycle, snapshot.currency)} cumulative</span>
          </div>
          <div className="space-y-2">
            {snapshot.cashCycle.map((c) => {
              const width = totalCashCycle > 0 ? Math.max(8, Math.round((c.amount / totalCashCycle) * 100)) : 8;
              return (
                <div key={c.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-800">{c.label}</p>
                    <p className="text-sm font-semibold text-zinc-950">{formatMoney(c.amount, snapshot.currency)}</p>
                  </div>
                  <div className="h-2 rounded bg-zinc-200">
                    <div className="h-2 rounded bg-gradient-to-r from-sky-500 to-violet-600" style={{ width: `${width}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-600">{c.hint}</p>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <article className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-violet-950">AI Executive Narrative</h3>
          <button
            type="button"
            disabled={insightBusy}
            onClick={() => void askAi()}
            className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {insightBusy ? "Generating…" : "Generate Insight"}
          </button>
        </div>
        <p className="mt-1 text-xs text-violet-900/80">
          Ask what matters now (risk clusters, cash-cycle pressure points, where to act first).
        </p>
        <textarea
          rows={2}
          className="mt-2 w-full rounded border border-violet-200 bg-white px-2 py-1.5 text-sm text-zinc-900"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Where is the biggest near-term operational risk and what should we review first?"
        />
        {insightErr ? <p className="mt-2 text-xs text-red-700">{insightErr}</p> : null}
        {insight ? (
          <div className="mt-2 whitespace-pre-wrap rounded border border-violet-200 bg-white px-3 py-2 text-sm text-zinc-800">
            {insight}
          </div>
        ) : null}
      </article>

      <div className="flex flex-wrap gap-2">
        {canPo ? (
          <Link href="/reports" className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">
            PO reports
          </Link>
        ) : null}
        {canCt ? (
          <Link
            href="/control-tower/reports"
            className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm text-sky-900 hover:bg-sky-100"
          >
            Control Tower reports
          </Link>
        ) : null}
        {canCrm ? (
          <Link
            href="/crm/reporting"
            className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm text-violet-900 hover:bg-violet-100"
          >
            CRM reporting
          </Link>
        ) : null}
        {canWms ? (
          <Link
            href="/wms/reporting"
            className="rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm text-violet-900 hover:bg-violet-100"
          >
            WMS reporting
          </Link>
        ) : null}
      </div>
    </section>
  );
}
