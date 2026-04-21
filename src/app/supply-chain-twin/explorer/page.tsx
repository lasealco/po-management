import type { Metadata } from "next";

import { AccessDenied } from "@/components/access-denied";
import { TwinSubNav } from "@/components/supply-chain-twin/twin-subnav";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";
import { listForTenant } from "@/lib/supply-chain-twin/repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supply Chain Twin — Explorer",
  description: "Catalog-style explorer over twin entity snapshots (preview).",
};

export default async function SupplyChainTwinExplorerPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string | string[] }>;
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

  const items = await listForTenant(access.tenant.id, { q });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <TwinSubNav />

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Twin explorer</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Entity explorer</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Same catalog as the overview module preview, with room for graph and timeline views later. Filters below are
          placeholders except search, which passes <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">q</code>{" "}
          to the list query.
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

      <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Entities</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{items.length} row{items.length === 1 ? "" : "s"}</p>
        </div>
        {items.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-zinc-600">No entities match this view.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-3">Kind</th>
                  <th className="px-5 py-3">Entity key</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-800">
                {items.map((row) => (
                  <tr key={`${row.ref.kind}:${row.ref.id}`} className="hover:bg-zinc-50/80">
                    <td className="px-5 py-3 font-mono text-xs text-zinc-600">{row.ref.kind}</td>
                    <td className="px-5 py-3">{row.ref.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
