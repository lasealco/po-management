import type { Metadata } from "next";

import { AccessDenied } from "@/components/access-denied";
import { TwinExplorerEntitiesTable } from "@/components/supply-chain-twin/twin-explorer-entities-table";
import { TwinExplorerRecentEventsStrip } from "@/components/supply-chain-twin/twin-explorer-recent-events-strip";
import { TwinGraphStubPanel } from "@/components/supply-chain-twin/twin-graph-stub-panel";
import { TwinSubNav } from "@/components/supply-chain-twin/twin-subnav";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supply Chain Twin — Explorer",
  description: "Catalog-style explorer over twin entity snapshots (preview).",
};

export default async function SupplyChainTwinExplorerPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[]; snapshot?: string | string[] }>;
}) {
  const access = await getViewerGrantSet();
  const { linkVisibility } = await resolveNavState(access);

  if (!access?.user) {
    return (
      <AccessDenied
        title="Supply Chain Twin"
        message="Choose an active demo user in Settings → Demo session, then return here."
      />
    );
  }

  if (!linkVisibility?.supplyChainTwin) {
    return (
      <AccessDenied
        title="Supply Chain Twin"
        message="This preview is available for workspace sessions with cross-module access. Try a broader demo role or open the platform hub."
      />
    );
  }

  const sp = searchParams ? await searchParams : {};
  const rawQ = sp.q;
  const q = typeof rawQ === "string" ? rawQ : Array.isArray(rawQ) ? rawQ[0] ?? "" : "";
  const rawSnapshot = sp.snapshot;
  const snapshotParam =
    typeof rawSnapshot === "string"
      ? rawSnapshot.trim()
      : Array.isArray(rawSnapshot)
        ? (rawSnapshot[0]?.trim() ?? "")
        : "";
  const graphSnapshotId =
    snapshotParam.length > 0 && snapshotParam.length <= 128 ? snapshotParam : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <TwinSubNav />

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Twin explorer</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Entity explorer</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Entity rows are loaded from <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">GET /api/supply-chain-twin/entities</code>{" "}
          (same contract as the overview catalog). Filters below are placeholders except search, which sets query{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">q</code>.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Filters</h2>
        <form className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end" method="get" action="/supply-chain-twin/explorer">
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

      <TwinExplorerEntitiesTable key={q} searchQ={q} />

      <section className="mt-6">
        <TwinGraphStubPanel key={`${q}::${graphSnapshotId ?? ""}`} searchQ={q} selectedSnapshotId={graphSnapshotId} />
      </section>
    </main>
  );
}
