import Link from "next/link";

import { tariffGeographyTypeLabel } from "@/lib/tariff/geography-labels";
import { listTariffGeographyGroups } from "@/lib/tariff/geography-groups";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

export default async function TariffGeographyDirectoryPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "edit"));
  const groups = await listTariffGeographyGroups({ take: 500 });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Internal admin</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Geography groups</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Define reusable geography scopes for tariff rate lines and charges. Use{" "}
              <span className="font-medium">Carrier / external label</span> on a group to remember how a carrier
              names the region; a future mapping tool can match those strings to these groups.
            </p>
          </div>
          {canEdit ? (
            <Link
              href="/tariffs/geography/new"
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
            >
              New group
            </Link>
          ) : null}
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Carrier label</th>
                <th className="py-2 pr-4">Valid</th>
                <th className="py-2 pr-4">Active</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-500">
                    No geography groups yet.
                    {canEdit ? (
                      <>
                        {" "}
                        <Link href="/tariffs/geography/new" className="font-medium text-[var(--arscmp-primary)] hover:underline">
                          Create one
                        </Link>
                        .
                      </>
                    ) : null}
                  </td>
                </tr>
              ) : null}
              {groups.map((g) => (
                <tr key={g.id} className="border-b border-zinc-100">
                  <td className="py-3 pr-4">
                    <Link href={`/tariffs/geography/${g.id}`} className="font-medium text-[var(--arscmp-primary)] hover:underline">
                      {g.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-zinc-700">{tariffGeographyTypeLabel(g.geographyType)}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-zinc-600">{g.code ?? "—"}</td>
                  <td className="max-w-[14rem] truncate py-3 pr-4 text-xs text-zinc-500" title={g.aliasSource ?? undefined}>
                    {g.aliasSource ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-xs text-zinc-600">
                    {fmtDate(g.validFrom)} → {fmtDate(g.validTo)}
                  </td>
                  <td className="py-3 pr-4 text-xs">{g.active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
