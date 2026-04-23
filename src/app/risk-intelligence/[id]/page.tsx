import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/access-denied";
import { PageTitleWithHint } from "@/components/page-title-with-hint";
import { ScriRecommendationsPanel } from "@/components/risk-intelligence/scri-recommendations-panel";
import { ScriRunMatchButton } from "@/components/risk-intelligence/scri-run-match-button";
import { ScriTriagePanel } from "@/components/risk-intelligence/scri-triage-panel";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
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

  const assignableUsers = await prisma.user.findMany({
    where: { tenantId: access.tenant.id, isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 120,
  });

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
        <p className="mt-1 text-xs text-zinc-500">
          Owner:{" "}
          {e.owner ? (
            <span className="font-medium text-zinc-700">{e.owner.name}</span>
          ) : (
            <span className="text-zinc-400">Unassigned</span>
          )}
        </p>
      </header>

      <div className="mt-6 space-y-4">
        {canRunMatch ? (
          <ScriTriagePanel
            key={e.updatedAt}
            eventId={e.id}
            initialReviewState={e.reviewState}
            initialOwnerId={e.owner?.id ?? null}
            assignableUsers={assignableUsers}
          />
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Internal exposure (R2)
              </p>
              <p className="mt-2 text-sm text-zinc-700">
                {e.affectedTotal > 0 ? (
                  <>
                    <span className="font-semibold tabular-nums text-zinc-900">{e.affectedTotal}</span>{" "}
                    deterministic match{e.affectedTotal === 1 ? "" : "es"} (shipments, POs, suppliers, sales
                    orders, warehouses, inventory).
                  </>
                ) : (
                  <span className="text-zinc-500">
                    No matches yet. Geography on this event is matched to live tenant data (R2).
                  </span>
                )}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Each row includes a <span className="font-medium text-zinc-600">rationale</span> explaining the
                geography or object rule used. Tentative matches are labeled; they need extra validation before
                executive use.
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
                        {a.impactLevelLabel ? ` · ${a.impactLevelLabel}` : ""}
                      </span>
                      {a.matchTier === "TENTATIVE" ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                          Tentative
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-600">{a.rationale}</p>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        <ScriRecommendationsPanel canEdit={canRunMatch} recommendations={e.recommendations} />

        {e.shortSummary || e.longSummary ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Ingest narrative</p>
            <p className="mt-1 text-xs text-zinc-500">
              Operator-facing text from the feed / connector. Distinct from the generated summary below.
            </p>
            {e.shortSummary ? (
              <p className="mt-3 text-sm text-zinc-800">{e.shortSummary}</p>
            ) : null}
            {e.longSummary ? (
              <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">{e.longSummary}</p>
            ) : null}
          </section>
        ) : null}

        {e.sources.length ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Primary sources ({e.sources.length})
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Facts trace to these rows. Excerpts are truncated for display.
            </p>
            <ul className="mt-3 space-y-4">
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
                  {"extractedTextPreview" in s && s.extractedTextPreview ? (
                    <p className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50 p-2 text-xs leading-relaxed text-zinc-600">
                      {s.extractedTextPreview}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
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

        {e.aiSummary ? (
          <section className="rounded-2xl border border-amber-100 bg-amber-50/80 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-900/80">
              AI-assisted summary
            </p>
            <p className="mt-1 text-xs text-amber-900/70">{e.aiSummarySourceLabel}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-amber-950">{e.aiSummary}</p>
          </section>
        ) : null}

        {e.reviewLogs.length ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Triage log</p>
            <ul className="mt-3 max-h-64 space-y-3 overflow-auto text-sm text-zinc-700">
              {e.reviewLogs.map((log) => (
                <li key={log.id} className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-xs text-zinc-500">
                    {new Date(log.createdAt).toLocaleString()} · {log.actor.name}
                  </p>
                  <p className="mt-1">
                    <span className="font-medium text-zinc-900">
                      {log.reviewStateFrom.replace(/_/g, " ")} → {log.reviewStateTo.replace(/_/g, " ")}
                    </span>
                    {log.ownerUserIdFrom !== log.ownerUserIdTo ? (
                      <span className="text-zinc-600"> · owner updated</span>
                    ) : null}
                  </p>
                  {log.note ? <p className="mt-1 text-xs text-zinc-600">{log.note}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {e.taskLinks.length ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Task links</p>
            <ul className="mt-3 space-y-2 text-sm text-zinc-700">
              {e.taskLinks.map((t) => {
                const href =
                  t.taskRef.startsWith("http://") || t.taskRef.startsWith("https://")
                    ? t.taskRef
                    : null;
                return (
                  <li key={t.id}>
                    <span className="font-medium text-zinc-900">{t.sourceModule}</span>
                    {t.status ? <span className="text-zinc-500"> · {t.status}</span> : null}
                    <div className="mt-0.5 truncate">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-800 underline-offset-2 hover:underline"
                        >
                          {t.taskRef}
                        </a>
                      ) : (
                        <span className="font-mono text-xs">{t.taskRef}</span>
                      )}
                    </div>
                    {t.note ? <p className="text-xs text-zinc-500">{t.note}</p> : null}
                    <p className="text-[10px] text-zinc-400">
                      Added by {t.createdBy.name} · {new Date(t.createdAt).toLocaleString()}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Structured payload (machine-readable)
          </p>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-800">
            {JSON.stringify(e.structuredPayload, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
