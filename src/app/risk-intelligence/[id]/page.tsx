import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/access-denied";
import { PageTitleWithHint } from "@/components/page-title-with-hint";
import { ScriRunMatchButton } from "@/components/risk-intelligence/scri-run-match-button";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { toScriEventDetailDto } from "@/lib/scri/event-dto";
import { formatScriFreshness } from "@/lib/scri/format-freshness";
import { getScriEventForTenant } from "@/lib/scri/event-repo";
import { scriObjectHref } from "@/lib/scri/object-links";

export const dynamic = "force-dynamic";

export default async function RiskIntelligenceEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const row = await getScriEventForTenant(access.tenant.id, id);
  if (!row) notFound();

  const canRunMatch = viewerHas(access.grantSet, "org.scri", "edit");
  const e = toScriEventDetailDto(row);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <p className="text-xs text-zinc-500">
        <Link href="/risk-intelligence" className="font-medium text-amber-800 hover:underline">
          ← Risk intelligence
        </Link>
      </p>

      <header className="mt-4">
        <PageTitleWithHint title={e.title} titleClassName="text-2xl font-semibold text-zinc-900" />
        <p className="mt-2 text-sm text-zinc-600">
          {e.eventTypeLabel} ({e.eventType}) · {e.severity} · {e.reviewState.replace(/_/g, " ")}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Discovered {new Date(e.discoveredTime).toLocaleString()} ({formatScriFreshness(e.discoveredTime)})
          {e.eventTime
            ? ` · Event time ${new Date(e.eventTime).toLocaleString()}`
            : ""}
          {" · "}
          {e.sourceCount} {e.sourceCount === 1 ? "source" : "sources"}
          {e.sourceTrustScore != null ? ` · Source trust ${e.sourceTrustScore}%` : ""}
        </p>
        {e.clusterKey ? (
          <p className="mt-1 text-xs text-zinc-500">
            Cluster{" "}
            <Link
              href={`/risk-intelligence?cluster=${encodeURIComponent(e.clusterKey)}`}
              className="font-medium text-amber-800 underline-offset-2 hover:underline"
            >
              {e.clusterKey}
            </Link>
          </p>
        ) : null}
      </header>

      <div className="mt-6 space-y-4">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Internal exposure
              </p>
              <p className="mt-2 text-sm text-zinc-700">
                {e.affectedTotal > 0 ? (
                  <>
                    <span className="font-semibold tabular-nums text-zinc-900">{e.affectedTotal}</span>{" "}
                    deterministic match{e.affectedTotal === 1 ? "" : "es"} (shipments, POs, suppliers, sales
                    orders).
                  </>
                ) : (
                  <span className="text-zinc-500">
                    No matches yet. Geography on this event is matched to live tenant data (R2).
                  </span>
                )}
              </p>
            </div>
            {canRunMatch ? <ScriRunMatchButton eventId={e.id} /> : null}
          </div>
          {e.affectedEntities.length ? (
            <ul className="mt-4 max-h-64 divide-y divide-zinc-100 overflow-auto border-t border-zinc-100 pt-3 text-sm">
              {e.affectedEntities.map((a) => {
                const href = scriObjectHref(a.objectType, a.objectId);
                return (
                  <li key={a.id} className="py-2 first:pt-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      {href ? (
                        <Link href={href} className="font-medium text-amber-800 underline-offset-2 hover:underline">
                          {a.objectType.replace(/_/g, " ")}
                        </Link>
                      ) : (
                        <span className="font-medium text-zinc-800">{a.objectType.replace(/_/g, " ")}</span>
                      )}
                      <span className="text-xs text-zinc-500">
                        {a.matchType.replace(/_/g, " ")} · {a.matchConfidence}%
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-600">{a.rationale}</p>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        {e.shortSummary ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Summary</p>
            <p className="mt-2 text-sm text-zinc-700">{e.shortSummary}</p>
          </section>
        ) : null}

        {e.longSummary ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Detail</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{e.longSummary}</p>
          </section>
        ) : null}

        {e.geographies.length ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Geography</p>
            <ul className="mt-2 space-y-2 text-sm text-zinc-700">
              {e.geographies.map((g) => (
                <li key={g.id} className="list-inside list-disc">
                  <span>
                    {[g.label, g.portUnloc, g.region, g.countryCode].filter(Boolean).join(" · ") || "—"}
                  </span>
                  {g.raw != null ? (
                    <pre className="mt-1 ml-4 max-w-full overflow-x-auto rounded border border-zinc-100 bg-zinc-50 p-2 text-[10px] leading-snug text-zinc-600">
                      {JSON.stringify(g.raw, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {e.sources.length ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Sources ({e.sources.length})
            </p>
            <ul className="mt-3 space-y-3">
              {e.sources.map((s) => (
                <li key={s.id} className="text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">{s.sourceType}</span>
                  {s.publisher ? (
                    <span className="text-zinc-500"> · {s.publisher}</span>
                  ) : null}
                  {s.headline ? ` — ${s.headline}` : null}
                  {s.url ? (
                    <div className="mt-1 truncate">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-800 underline-offset-2 hover:underline"
                      >
                        {s.url}
                      </a>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {e.aiSummary ? (
          <section className="rounded-2xl border border-amber-100 bg-amber-50/80 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-900/80">AI summary</p>
            <p className="mt-2 text-sm text-amber-950">{e.aiSummary}</p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Structured payload</p>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-800">
            {JSON.stringify(e.structuredPayload, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
