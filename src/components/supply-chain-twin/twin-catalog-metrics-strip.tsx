"use client";

import { useEffect, useState } from "react";

import { twinApiClientErrorMessage } from "@/lib/supply-chain-twin/error-codes";
import { parseTwinCatalogMetricsResponseJson } from "@/lib/supply-chain-twin/twin-catalog-metrics-response";
import type { TwinCatalogMetricsResponse } from "@/lib/supply-chain-twin/schemas/twin-api-responses";
import { TWIN_ENTITY_KINDS } from "@/lib/supply-chain-twin/types";

const ENTITY_KIND_DISPLAY_ORDER = [...TWIN_ENTITY_KINDS, "other"] as const;

function formatEntityKindLabel(kind: string): string {
  return kind.replace(/_/g, " ");
}

function TwinEntityKindBreakdown(props: { data: TwinCatalogMetricsResponse }) {
  const { data } = props;
  const { entities, entityCountsByKind } = data;
  const byKind = entityCountsByKind as Record<string, number>;
  const orderedPositive = ENTITY_KIND_DISPLAY_ORDER.map((k) => [k, byKind[k] ?? 0] as const).filter(([, n]) => n > 0);

  if (entities === 0) {
    return (
      <div className="mt-6 border-t border-zinc-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Entities by kind</p>
        <p className="mt-2 text-sm text-zinc-600">No entity snapshots for this tenant yet.</p>
      </div>
    );
  }

  if (orderedPositive.length === 0) {
    return (
      <div className="mt-6 border-t border-zinc-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Entities by kind</p>
        <p className="mt-2 text-sm text-zinc-600">
          Entity total is {entities}, but per-kind counts are empty in this response.
        </p>
      </div>
    );
  }

  const sumByKind = orderedPositive.reduce((acc, [, n]) => acc + n, 0);

  return (
    <div className="mt-6 border-t border-zinc-100 pt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Entities by kind</p>
      <p className="mt-1 max-w-2xl text-xs text-zinc-500">
        Kinds with zero rows are omitted. Unknown <code className="rounded bg-zinc-100 px-1 text-[11px]">entityKind</code>{" "}
        values are grouped under <span className="font-medium text-zinc-700">other</span>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {orderedPositive.map(([kind, n]) => (
          <span
            key={kind}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-800 shadow-sm"
          >
            <span className="capitalize text-zinc-700">{formatEntityKindLabel(kind)}</span>
            <span className="tabular-nums text-zinc-900">{n}</span>
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {sumByKind === entities
          ? `Listed kinds sum to ${entities} snapshot row${entities === 1 ? "" : "s"}.`
          : `Listed kinds sum to ${sumByKind}; total entities is ${entities}.`}
      </p>
    </div>
  );
}

type StripState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ok"; data: TwinCatalogMetricsResponse };

const METRIC_CELLS: Array<{
  key: "entities" | "edges" | "events" | "scenarioDrafts" | "riskSignals";
  label: string;
}> = [
  { key: "entities", label: "Entities" },
  { key: "edges", label: "Edges" },
  { key: "events", label: "Ingest events" },
  { key: "scenarioDrafts", label: "Scenario drafts" },
  { key: "riskSignals", label: "Risk signals" },
];

async function fetchMetrics(): Promise<StripState> {
  try {
    const res = await fetch("/api/supply-chain-twin/metrics", { cache: "no-store" });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        kind: "error",
        message: twinApiClientErrorMessage(body, "Catalog counts could not be loaded for this session."),
      };
    }
    const parsed = parseTwinCatalogMetricsResponseJson(body);
    if (!parsed.ok) {
      return { kind: "error", message: "Unexpected response when loading catalog counts." };
    }
    return { kind: "ok", data: parsed.data };
  } catch {
    return { kind: "error", message: "Network error while loading catalog counts." };
  }
}

export function TwinCatalogMetricsStrip() {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<StripState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await fetchMetrics();
      if (!cancelled) {
        setState(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Catalog</p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-900">Twin data counts</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Tenant-scoped totals from{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">GET /api/supply-chain-twin/metrics</code>, including
            a per-entity-kind breakdown under the count tiles. Refresh to pull the latest numbers after seeding or edits.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setState({ kind: "loading" });
            setTick((n) => n + 1);
          }}
          disabled={state.kind === "loading"}
          className="shrink-0 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.kind === "loading" ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {state.kind === "loading" ? (
        <p className="mt-5 text-sm text-zinc-500">Loading catalog counts…</p>
      ) : null}

      {state.kind === "error" ? (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{state.message}</p>
      ) : null}

      {state.kind === "ok" ? (
        <>
          {state.data.scenarioDrafts > 0 &&
          state.data.entities === 0 &&
          state.data.edges === 0 &&
          state.data.events === 0 &&
          state.data.riskSignals === 0 ? (
            <div
              className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              role="status"
            >
              <p className="font-semibold text-amber-950">Catalog looks only partially filled</p>
              <p className="mt-1 text-amber-900/90">
                Scenario drafts exist, but there are no entity snapshots, edges, ingest events, or risk signals for
                this tenant. That usually means the Twin demo seed has not been run against the{" "}
                <span className="font-medium">same database</span> this deployment uses (for example production Neon
                vs. a dev branch). From a machine with{" "}
                <code className="rounded bg-amber-100/80 px-1 py-0.5 font-mono text-xs">DATABASE_URL</code> pointing at
                this environment&apos;s Postgres, run{" "}
                <code className="rounded bg-amber-100/80 px-1 py-0.5 font-mono text-xs">
                  npm run db:seed:supply-chain-twin-demo
                </code>{" "}
                (after{" "}
                <code className="rounded bg-amber-100/80 px-1 py-0.5 font-mono text-xs">npm run db:seed</code> if the
                tenant is missing). See{" "}
                <code className="rounded bg-amber-100/80 px-1 py-0.5 font-mono text-xs">docs/sctwin/runbook.md</code>{" "}
                → Seed commands.
              </p>
            </div>
          ) : null}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {METRIC_CELLS.map((cell) => (
              <div
                key={cell.key}
                className="rounded-xl border border-zinc-200 bg-zinc-50/90 px-4 py-3 text-center shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{cell.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{state.data[cell.key]}</p>
              </div>
            ))}
          </div>
          <TwinEntityKindBreakdown data={state.data} />
        </>
      ) : null}
    </section>
  );
}
