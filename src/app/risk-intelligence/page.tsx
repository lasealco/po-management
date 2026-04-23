import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { PageTitleWithHint } from "@/components/page-title-with-hint";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { formatScriFreshness } from "@/lib/scri/format-freshness";
import { toScriEventListItemDto } from "@/lib/scri/event-dto";
import { listScriEventsForTenant } from "@/lib/scri/event-repo";

export const dynamic = "force-dynamic";

function clusterFromSearch(
  raw: string | string[] | undefined,
): string | undefined {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const t = s?.trim();
  return t || undefined;
}

export default async function RiskIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getViewerGrantSet();

  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <AccessDenied
          title="Risk intelligence"
          message="Choose an active demo user: Settings → Demo session (/settings/demo), then reload."
        />
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.scri", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <AccessDenied
          title="Risk intelligence"
          message="You do not have permission to view Supply Chain Risk Intelligence (org.scri → view)."
        />
      </div>
    );
  }

  const sp = await searchParams;
  const clusterFilter = clusterFromSearch(sp.cluster);
  const rows = await listScriEventsForTenant(access.tenant.id, 80, {
    clusterKey: clusterFilter,
  });
  const events = rows.map(toScriEventListItemDto);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <PageTitleWithHint
          title="Risk intelligence"
          titleClassName="text-2xl font-semibold tracking-tight text-zinc-900"
        />
        <p className="mt-2 text-sm text-zinc-600">
          External supply-chain events for{" "}
          <span className="font-medium text-zinc-800">{access.tenant.name}</span>.{" "}
          <span className="text-zinc-500">
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
        </p>
        {clusterFilter ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
            Filtered by cluster{" "}
            <code className="rounded bg-white/80 px-1 py-0.5 text-xs">{clusterFilter}</code>.{" "}
            <Link href="/risk-intelligence" className="font-medium text-amber-900 underline-offset-2 hover:underline">
              Clear filter
            </Link>
          </p>
        ) : null}
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Event feed</p>
        <ul className="mt-4 divide-y divide-zinc-100">
          {events.map((e) => (
            <li key={e.id} className="py-4 first:pt-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/risk-intelligence/${e.id}`}
                      className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                    >
                      {e.title}
                    </Link>
                    {e.clusterKey ? (
                      <Link
                        href={`/risk-intelligence?cluster=${encodeURIComponent(e.clusterKey)}`}
                        className="shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100"
                        title="Filter feed by this cluster key"
                      >
                        cluster
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {e.eventTypeLabel} · {e.severity} · confidence {e.confidence}% ·{" "}
                    {formatScriFreshness(e.discoveredTime)} · {e.sourceCount}{" "}
                    {e.sourceCount === 1 ? "source" : "sources"}
                    {e.sourceTrustScore != null ? ` · trust ${e.sourceTrustScore}%` : ""}
                    {e.geographySummary ? ` · ${e.geographySummary}` : ""}
                  </p>
                  {e.shortSummary ? (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{e.shortSummary}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {e.affectedTotal > 0 ? (
                      <>
                        Exposure:{" "}
                        <span className="font-medium text-zinc-700">{e.affectedTotal}</span>{" "}
                        {e.affectedTotal === 1 ? "link" : "links"}
                        {Object.keys(e.affectedCounts).length ? (
                          <span className="text-zinc-400">
                            {" "}
                            (
                            {Object.entries(e.affectedCounts)
                              .map(([k, v]) => `${v}× ${k.replace(/_/g, " ")}`)
                              .join(", ")}
                            )
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-zinc-400">No exposure match yet — open detail to run network match.</span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
                  {e.reviewState.replace(/_/g, " ")}
                </span>
              </div>
            </li>
          ))}
        </ul>
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            No events yet. Run{" "}
            <code className="rounded bg-zinc-100 px-1">npm run db:seed:scri</code> for SCRI demo rows, full{" "}
            <code className="rounded bg-zinc-100 px-1">npm run db:seed</code> for volume, or ingest via{" "}
            <code className="rounded bg-zinc-100 px-1">POST /api/scri/events</code>.
          </p>
        ) : null}
      </section>
    </main>
  );
}
