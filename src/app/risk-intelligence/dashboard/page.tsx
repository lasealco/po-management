import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { PageTitleWithHint } from "@/components/page-title-with-hint";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getScriDashboardStats } from "@/lib/scri/dashboard-aggregates";
import { getScriTuningForTenant } from "@/lib/scri/tuning-repo";
import { listWatchlistRulesForTenant } from "@/lib/scri/watchlist-repo";

export const dynamic = "force-dynamic";

export default async function RiskIntelligenceDashboardPage() {
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

  const { dto: tuning } = await getScriTuningForTenant(access.tenant.id);
  const rules = await listWatchlistRulesForTenant(access.tenant.id);
  const stats = await getScriDashboardStats(access.tenant.id, tuning, rules);
  const activeRules = rules.filter((r) => r.isActive).length;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <p className="text-xs text-zinc-500">
        <Link href="/risk-intelligence" className="font-medium text-amber-800 hover:underline">
          ← Event feed
        </Link>
      </p>
      <header className="mt-4">
        <PageTitleWithHint
          title="Risk dashboard"
          titleClassName="text-2xl font-semibold tracking-tight text-zinc-900"
        />
        <p className="mt-2 text-sm text-zinc-600">
          Aggregates for <span className="font-medium text-zinc-800">{access.tenant.name}</span>. Impact counts use
          R2 matches from the last 30 days.
        </p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Events</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{stats.totalEvents}</p>
          <p className="text-xs text-zinc-500">All time in tenant</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Critical (30d)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-red-700">{stats.criticalRecent}</p>
          <p className="text-xs text-zinc-500">Since {new Date(stats.recentSince).toLocaleDateString()}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Watchlist</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-900">{activeRules}</p>
          <p className="text-xs text-zinc-500">
            Active rules · {stats.watchlistMatchRecentCount} recent events matched (sample of 200)
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Tuning signals</p>
          <p className="mt-2 text-sm text-zinc-700">
            Below trust floor: <span className="font-semibold tabular-nums">{stats.lowTrustCount}</span>
          </p>
          <p className="mt-1 text-sm text-zinc-700">
            Above severity highlight: <span className="font-semibold tabular-nums">{stats.highlightSeverityCount}</span>
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Severity distribution</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-zinc-700">
          {Object.entries(stats.bySeverity)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([sev, n]) => (
              <li key={sev} className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2">
                <span>{sev}</span>
                <span className="font-semibold tabular-nums text-zinc-900">{n}</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Impacted objects (30d)</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-zinc-700">
          {Object.keys(stats.impactedByType).length === 0 ? (
            <li className="text-zinc-500">No R2 links in window.</li>
          ) : (
            Object.entries(stats.impactedByType)
              .sort(([, a], [, b]) => b - a)
              .map(([k, n]) => (
                <li key={k} className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2">
                  <span>{k.replace(/_/g, " ")}</span>
                  <span className="font-semibold tabular-nums text-zinc-900">{n}</span>
                </li>
              ))
          )}
        </ul>
      </section>

      {viewerHas(access.grantSet, "org.scri", "edit") ? (
        <p className="mt-6 text-sm text-zinc-600">
          Configure watchlists and tuning in{" "}
          <Link href="/settings/risk-intelligence" className="font-medium text-amber-800 underline-offset-2 hover:underline">
            Settings → Risk intelligence
          </Link>
          .
        </p>
      ) : null}
    </main>
  );
}
