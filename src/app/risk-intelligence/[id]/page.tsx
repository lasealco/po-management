import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/access-denied";
import { PageTitleWithHint } from "@/components/page-title-with-hint";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { toScriEventDetailDto } from "@/lib/scri/event-dto";
import { getScriEventForTenant } from "@/lib/scri/event-repo";

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
          {e.eventType} · {e.severity} · {e.reviewState.replace(/_/g, " ")} · discovered{" "}
          {new Date(e.discoveredTime).toLocaleString()}
        </p>
      </header>

      <div className="mt-6 space-y-4">
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
            <ul className="mt-2 list-inside list-disc text-sm text-zinc-700">
              {e.geographies.map((g) => (
                <li key={g.id}>
                  {[g.label, g.portUnloc, g.region, g.countryCode].filter(Boolean).join(" · ") || "—"}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {e.sources.length ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sources</p>
            <ul className="mt-3 space-y-3">
              {e.sources.map((s) => (
                <li key={s.id} className="text-sm text-zinc-700">
                  <span className="font-medium text-zinc-900">{s.sourceType}</span>
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
