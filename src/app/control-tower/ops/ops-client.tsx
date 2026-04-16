"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type OpsSummary = {
  generatedAt: string;
  isCustomerView: boolean;
  slaOps: {
    backlogAlerts: number | null;
    backlogExceptions: number | null;
    staleBacklogAlerts: number | null;
    staleBacklogExceptions: number | null;
    escalationRuns24h: number | null;
    escalationSweepRuns7d: number | null;
    escalationActions7d: number | null;
  };
  ownerBalancing:
    | {
        overloadedOwners: number;
        underloadedOwners: number;
        suggestedCapacityThreshold: number;
        topOwners: Array<{
          id: string;
          name: string;
          openAlerts: number;
          openExceptions: number;
          total: number;
        }>;
      }
    | null;
  exceptionLifecycle:
    | {
        openByType: Array<{ type: string; count: number }>;
      }
    | null;
  routeEta: {
    deliveredCompared: number;
    onTimePct: number;
    delayedPct: number;
    onTimeCount: number;
    delayedCount: number;
  };
  collaboration: {
    mentionAlertsOpen: number | null;
    sharedNotes7d: number;
  };
  customerPack: {
    restrictedView: boolean;
    sharedNotes7d: number;
  };
  automationRules: {
    activeRules: string[];
  };
  opsConsole:
    | {
        recentRuns: Array<{
          id: string;
          action: string;
          actorName: string;
          createdAt: string;
        }>;
      }
    | null;
};

export function ControlTowerOpsClient({ initialSummary, focus }: { initialSummary: OpsSummary; focus?: string }) {
  const [summary, setSummary] = useState(initialSummary);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [refreshErr, setRefreshErr] = useState<string | null>(null);
  const [focusHint, setFocusHint] = useState<string | null>(null);

  useEffect(() => {
    if (!focus) return;
    const map: Record<string, { id: string; label: string }> = {
      exceptions: { id: "ct-ops-exception-lifecycle", label: "Exception lifecycle taxonomy" },
      owners: { id: "ct-ops-owner-capacity", label: "Owner capacity balancing" },
      automation: { id: "ct-ops-automation", label: "Automation rules engine" },
    };
    const target = map[focus];
    if (!target) return;
    setFocusHint(`Focused view: ${target.label}`);
    const node = document.getElementById(target.id);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus]);

  const refresh = async () => {
    const res = await fetch("/api/control-tower/ops/summary");
    if (!res.ok) {
      setRefreshErr(`Could not refresh ops summary (${res.status}).`);
      return;
    }
    setRefreshErr(null);
    const data = (await res.json()) as OpsSummary;
    setSummary(data);
  };

  const runEscalation = async (dryRun: boolean) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/control-tower/ops/run-escalation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        shipmentsTouched?: number;
        openAlertCandidates?: number;
        openExceptionCandidates?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || res.statusText);
      setMsg(
        dryRun
          ? `Dry run: ${data.shipmentsTouched ?? 0} shipment(s) would be touched.`
          : `Run complete: ${data.shipmentsTouched ?? 0} shipment(s) processed.`,
      );
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  };

  const ownerRows = summary.ownerBalancing?.topOwners ?? [];
  const runs = summary.opsConsole?.recentRuns ?? [];
  const json = useMemo(() => JSON.stringify(summary, null, 2), [summary]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">SLA automation controls</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Run now or dry run the escalation workflow without waiting for cron.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runEscalation(true)}
              className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800 disabled:opacity-60"
            >
              Dry run escalation
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runEscalation(false)}
              className="rounded bg-sky-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
            >
              Run escalation now
            </button>
          </div>
        </div>
        {msg ? <p className="mt-2 text-xs text-zinc-700">{msg}</p> : null}
        {refreshErr ? <p className="mt-2 text-xs text-amber-800">{refreshErr}</p> : null}
        {focusHint ? (
          <p className="mt-2 rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-900">{focusHint}</p>
        ) : null}
        {!summary.isCustomerView ? (
          <p className="mt-3 text-xs text-zinc-600">
            After automation runs, clear or assign items in{" "}
            <Link href="/control-tower/workbench" className="font-medium text-sky-800 underline">
              Workbench
            </Link>{" "}
            and{" "}
            <Link href="/control-tower/command-center" className="font-medium text-sky-800 underline">
              Command center
            </Link>
            , then use Shipment 360 → Alerts / Exceptions to acknowledge, resolve, and close with audit trail.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-zinc-500">SLA backlog</p>
          <p className="mt-1 text-sm text-zinc-800">
            Alerts: <strong>{summary.slaOps.backlogAlerts ?? 0}</strong> · Exceptions:{" "}
            <strong>{summary.slaOps.backlogExceptions ?? 0}</strong>
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            7d stale: {summary.slaOps.staleBacklogAlerts ?? 0} alerts / {summary.slaOps.staleBacklogExceptions ?? 0}{" "}
            exceptions
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-zinc-500">Route ETA intelligence</p>
          <p className="mt-1 text-sm text-zinc-800">
            On-time: <strong>{summary.routeEta.onTimePct}%</strong> · Delayed:{" "}
            <strong>{summary.routeEta.delayedPct}%</strong>
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Compared shipments: {summary.routeEta.deliveredCompared}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-zinc-500">Collaboration</p>
          <p className="mt-1 text-sm text-zinc-800">
            Mention alerts open: <strong>{summary.collaboration.mentionAlertsOpen ?? 0}</strong>
          </p>
          <p className="mt-1 text-xs text-zinc-600">Shared notes 7d: {summary.collaboration.sharedNotes7d}</p>
        </div>
      </div>

      {summary.ownerBalancing ? (
        <div id="ct-ops-owner-capacity" className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Owner capacity balancing</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Threshold {summary.ownerBalancing.suggestedCapacityThreshold} open items · overloaded{" "}
            {summary.ownerBalancing.overloadedOwners} · underloaded {summary.ownerBalancing.underloadedOwners}
          </p>
          <ul className="mt-2 grid gap-2 text-sm md:grid-cols-2">
            {ownerRows.map((row) => (
              <li
                key={row.id}
                className="rounded border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-950"
              >
                <span className="font-medium">{row.name}</span>:{" "}
                <strong className="tabular-nums">{row.total}</strong> ({row.openAlerts} alerts /{" "}
                {row.openExceptions} exceptions)
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.exceptionLifecycle ? (
        <div id="ct-ops-exception-lifecycle" className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Exception lifecycle taxonomy</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {summary.exceptionLifecycle.openByType.map((r) => (
              <span
                key={r.type}
                className="rounded-full border border-zinc-400 bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-950"
              >
                {r.type}: <strong className="tabular-nums">{r.count}</strong>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div id="ct-ops-automation" className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Automation rules engine (lite)</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-zinc-700">
          {summary.automationRules.activeRules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {!summary.isCustomerView ? (
          <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            <p className="font-semibold text-zinc-800">SLA sweep telemetry</p>
            <p className="mt-1">
              <span className="tabular-nums font-medium text-zinc-900">
                {summary.slaOps.escalationRuns24h ?? 0}
              </span>{" "}
              sweep run(s) in the last <strong>24 hours</strong> (each Run now / dry run writes one audit).{" "}
              <span className="tabular-nums font-medium text-zinc-900">
                {summary.slaOps.escalationSweepRuns7d ?? 0}
              </span>{" "}
              sweep run(s) in the last <strong>7 days</strong>.
            </p>
            <p className="mt-1">
              <span className="tabular-nums font-medium text-zinc-900">
                {summary.slaOps.escalationActions7d ?? 0}
              </span>{" "}
              per-item SLA follow-ups in 7 days (internal note + SLA_ESCALATION alert).{" "}
              <strong>Dry runs</strong> count as sweeps but not here; dedupe can also skip new follow-ups.
            </p>
          </div>
        ) : null}
      </div>

      {runs.length ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Recent run history</h2>
          <p className="mt-1 text-xs text-zinc-600">
            Latest 20 audit rows (any age). Compare to the 24h / 7d counters above—older rows do not affect the 24h
            count.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700">
            {runs.map((r) => (
              <li key={r.id}>
                {new Date(r.createdAt).toLocaleString()} · {r.actorName} · {r.action}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Ops snapshot JSON</h2>
          <button
            type="button"
            className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-800"
            onClick={() => void navigator.clipboard.writeText(json)}
          >
            Copy
          </button>
        </div>
        <pre className="max-h-[22rem] overflow-auto rounded-md border border-zinc-300 bg-white p-4 font-mono text-sm leading-relaxed text-zinc-950 shadow-inner">
          {json}
        </pre>
      </div>
    </div>
  );
}
