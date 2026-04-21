import type { Metadata } from "next";

import { TwinExplorerEntitiesTable } from "@/components/supply-chain-twin/twin-explorer-entities-table";
import { TwinExplorerRecentEventsStrip } from "@/components/supply-chain-twin/twin-explorer-recent-events-strip";
import { TwinEventsExportAction } from "@/components/supply-chain-twin/twin-events-export-action";
import { TwinGraphStubPanel } from "@/components/supply-chain-twin/twin-graph-stub-panel";
import { TwinSubNav } from "@/components/supply-chain-twin/twin-subnav";
import {
  parseExplorerSnapshotFocusQuery,
  parseExplorerSnapshotQueryParam,
} from "@/lib/supply-chain-twin/explorer-focus-query";
import { requireTwinPageAccess } from "../_lib/require-twin-page-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supply Chain Twin — Explorer",
  description: "Catalog-style explorer over twin entity snapshots (preview).",
};

export default async function SupplyChainTwinExplorerPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[]; snapshot?: string | string[]; focus?: string | string[] }>;
}) {
  const gate = await requireTwinPageAccess();
  if (!gate.ok) {
    return gate.deniedUi;
  }

  const sp = searchParams ? await searchParams : {};
  const rawQ = sp.q;
  const q = typeof rawQ === "string" ? rawQ : Array.isArray(rawQ) ? rawQ[0] ?? "" : "";
  const focusParse = parseExplorerSnapshotFocusQuery(sp.focus);
  const snapshotFromQuery = parseExplorerSnapshotQueryParam(sp.snapshot);

  let explorerFocusError: string | null = null;
  let graphSnapshotId: string | null = null;
  if (focusParse.kind === "ok") {
    graphSnapshotId = focusParse.snapshotId;
  } else if (focusParse.kind === "invalid") {
    explorerFocusError = focusParse.message;
    graphSnapshotId = snapshotFromQuery;
  } else {
    graphSnapshotId = snapshotFromQuery;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <TwinSubNav />

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Twin explorer</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Entity explorer</h1>
          <TwinEventsExportAction />
        </div>
        <div className="mt-2 max-w-2xl space-y-2 text-sm text-zinc-600">
          <p>
            Browse entity snapshots for this workspace. Use <span className="font-medium text-zinc-800">Search</span>{" "}
            to narrow the list. Pick a row to open the detail view; the graph below shows related nodes when a row is in
            focus.
          </p>
          <p className="text-xs text-zinc-500">
            More filters (kind, date range) are on the roadmap — only search is active in this preview.
          </p>
          <details className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-600">
            <summary className="cursor-pointer font-medium text-zinc-700">Sharing links &amp; technical notes</summary>
            <p className="mt-2">
              Shared URLs can include <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">?focus=…</code>{" "}
              (internal snapshot id) so the graph opens on that entity and the matching table row is highlighted when it
              appears on the page. An older{" "}
              <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">snapshot=</code> parameter still
              works if <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">focus</code> is missing or
              invalid; when both are valid, <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">focus</code>{" "}
              controls the graph. Data loads from the same catalog API as the Twin overview (
              <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">GET /api/supply-chain-twin/entities</code>
              ).
            </p>
          </details>
        </div>
      </section>

      {explorerFocusError ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Invalid focus query</p>
          <p className="mt-1 text-amber-900/90">{explorerFocusError}</p>
        </div>
      ) : null}

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Filters</h2>
        <form className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end" method="get" action="/supply-chain-twin/explorer">
          {graphSnapshotId ? <input type="hidden" name="focus" value={graphSnapshotId} /> : null}
          <label className="block min-w-[200px] flex-1 text-sm">
            <span className="font-medium text-zinc-700">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Kind or entity key…"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </label>
          <label className="block min-w-[180px] text-sm opacity-60">
            <span className="font-medium text-zinc-700">Entity kind</span>
            <select disabled className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
              <option>All kinds (stub)</option>
            </select>
          </label>
          <label className="block min-w-[180px] text-sm opacity-60">
            <span className="font-medium text-zinc-700">Updated</span>
            <input type="date" disabled className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
          >
            Apply
          </button>
        </form>
      </section>

      <TwinExplorerRecentEventsStrip />

      <TwinExplorerEntitiesTable key={`${q}::${graphSnapshotId ?? ""}`} searchQ={q} highlightSnapshotId={graphSnapshotId} />

      <section className="mt-6">
        <TwinGraphStubPanel key={`${q}::${graphSnapshotId ?? ""}`} searchQ={q} selectedSnapshotId={graphSnapshotId} />
      </section>
    </main>
  );
}
