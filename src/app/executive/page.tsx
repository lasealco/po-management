import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { getActorUserId, getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { buildExecutiveSummary } from "@/lib/executive/summary";
import { controlTowerWorkbenchPath } from "@/lib/control-tower/workbench-url-sync";

export const dynamic = "force-dynamic";

function money(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

function num(v: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(v);
}

function pct(v: number | null) {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function deltaTone(delta: number | null, goodWhenDown: boolean): string {
  if (delta == null) return "text-zinc-400";
  const isGood = goodWhenDown ? delta < 0 : delta > 0;
  if (isGood) return "text-emerald-300";
  if (delta === 0) return "text-zinc-300";
  return "text-rose-300";
}

function deltaLabel(delta: number | null): string {
  if (delta == null) return "vs prior 30d: —";
  const sign = delta > 0 ? "+" : "";
  return `vs prior 30d: ${sign}${delta.toFixed(1)}%`;
}

export default async function ExecutiveDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string; tone?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const investorMode = (sp.view ?? "").toLowerCase() === "investor";
  const darkTone = (sp.tone ?? "").toLowerCase() === "dark";
  const brandTone = !darkTone;
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const actorId = await getActorUserId();

  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-zinc-700">
        Demo tenant not found. Run `npm run db:seed`.
      </main>
    );
  }
  if (!access?.user || !actorId) {
    return (
      <AccessDenied
        title="Executive dashboard"
        message="Choose an active demo user in Settings → Demo session."
      />
    );
  }
  if (!viewerHas(access.grantSet, "org.reports", "view")) {
    return (
      <AccessDenied
        title="Executive dashboard"
        message="You need org.reports → view permission to open the CEO dashboard."
      />
    );
  }

  const summary = await buildExecutiveSummary({ tenantId: tenant.id, actorUserId: actorId });
  const maxTrend = Math.max(
    1,
    ...summary.trends.flatMap((t) => [
      t.weightedPipelineValue,
      t.openPoValue,
      t.estimatedLogisticsSpend,
    ]),
  );
  const pageBgClass = brandTone ? "bg-[#07181b] text-zinc-100" : "bg-zinc-950 text-zinc-100";
  const heroBgClass = brandTone
    ? "border-b border-teal-300/20 bg-[radial-gradient(circle_at_top,_rgba(22,91,103,0.72),_rgba(7,24,27,0.96)_58%)]"
    : "border-b border-white/10 bg-[radial-gradient(circle_at_top,_rgba(22,91,103,0.5),_rgba(9,12,28,0.95)_55%)]";
  const panelClass = brandTone
    ? "rounded-2xl border border-teal-300/20 bg-[#0b2328]/75 p-6"
    : "rounded-2xl border border-white/10 bg-zinc-900/70 p-6";

  return (
    <main className={`min-h-screen ${pageBgClass}`}>
      <section className={heroBgClass}>
        <div className="mx-auto max-w-7xl px-6 py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
            {tenant.name} · Executive cockpit
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            CEO command center
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-300 sm:text-base">
            One view for growth outlook, supply risk, and capital exposure. Financial-style values
            below are operational estimates (pre-accounting integration).
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            As of {new Date(summary.asOfIso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-200">
              Operational estimate
            </span>
            <span className="rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1 text-xs font-medium text-sky-100">
              Not accounting posted
            </span>
            <Link
              href="/reporting"
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-100 hover:bg-white/10"
            >
              Open reporting hub
            </Link>
            <Link
              href="/control-tower/workbench"
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-100 hover:bg-white/10"
            >
              Open control tower workbench
            </Link>
            <Link
              href="/control-tower/digest"
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-100 hover:bg-white/10"
            >
              Shipment digest
            </Link>
            <Link
              href={controlTowerWorkbenchPath({ onlyOverdueEta: "1", sortBy: "eta_asc" })}
              className="rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100 hover:bg-amber-300/15"
            >
              Overdue inbound ETAs
            </Link>
            <Link
              href={
                investorMode
                  ? brandTone
                    ? "/executive"
                    : "/executive"
                  : brandTone
                    ? "/executive?view=investor"
                    : "/executive?view=investor"
              }
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                investorMode
                  ? "border border-emerald-300/40 bg-emerald-300/15 text-emerald-100"
                  : "border border-white/20 bg-white/5 text-zinc-100 hover:bg-white/10"
              }`}
            >
              {investorMode ? "Switch to operator view" : "Switch to investor narrative"}
            </Link>
            <Link
              href={
                brandTone
                  ? investorMode
                    ? "/executive?view=investor&tone=dark"
                    : "/executive?tone=dark"
                  : investorMode
                    ? "/executive?view=investor"
                    : "/executive"
              }
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                brandTone
                  ? "border border-teal-300/40 bg-teal-300/15 text-teal-100"
                  : "border border-white/20 bg-white/5 text-zinc-100 hover:bg-white/10"
              }`}
            >
              {brandTone ? "Use dark tone" : "Use brand tone"}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 pt-8 lg:grid-cols-[0.85fr,1.15fr]">
        <article className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.03] p-6">
          <p className="text-xs uppercase tracking-[0.15em] text-zinc-400">Executive health score</p>
          <div className="mt-3 flex items-end gap-4">
            <p className="text-5xl font-black leading-none text-white">{summary.health.score}</p>
            <p className="mb-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-semibold text-emerald-200">
              Grade {summary.health.grade}
            </p>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">{summary.health.narrative}</p>
          <div className="mt-5 h-2 rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-[linear-gradient(90deg,_#ef4444_0%,_#f59e0b_35%,_#10b981_100%)]"
              style={{ width: `${summary.health.score}%` }}
            />
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            Interpretation: 85+ strong operating posture, 72-84 controlled risk, 58-71 elevated
            pressure, below 58 requires immediate intervention.
          </p>
        </article>
        <article className={panelClass}>
          <h2 className="text-lg font-semibold text-white">CEO headline insights</h2>
          <ul className="mt-4 space-y-3">
            {summary.insights.map((insight) => (
              <li
                key={insight.title}
                className={`rounded-xl border px-4 py-3 ${
                  insight.tone === "critical"
                    ? "border-rose-400/30 bg-rose-400/10"
                    : insight.tone === "warning"
                      ? "border-amber-400/30 bg-amber-400/10"
                      : "border-emerald-400/30 bg-emerald-400/10"
                }`}
              >
                <p className="text-sm font-semibold text-white">{insight.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-200">{insight.detail}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 pt-5 lg:grid-cols-[1.15fr,0.85fr]">
        <article className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold text-white">Boardroom snapshot</h2>
          <p className="mt-1 text-xs text-zinc-400">
            30-second narrative for investment and steering conversations.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-200">Growth signal</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {money(summary.kpis.weightedPipelineValue)}
              </p>
              <p className="mt-1 text-xs text-emerald-100/90">Weighted pipeline opportunity</p>
            </div>
            <div className="rounded-xl border border-sky-300/20 bg-sky-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-sky-200">Supply readiness</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {pct(summary.kpis.demandCoverageRatio)}
              </p>
              <p className="mt-1 text-xs text-sky-100/90">Coverage against weighted demand</p>
            </div>
            <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-rose-200">Revenue exposed</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {money(summary.kpis.estimatedRevenueAtRisk)}
              </p>
              <p className="mt-1 text-xs text-rose-100/90">Linked to delayed inbound</p>
            </div>
          </div>
        </article>
        {!investorMode ? (
          <article className={panelClass}>
          <h2 className="text-lg font-semibold text-white">Assumptions & labels</h2>
          <ul className="mt-4 space-y-3 text-xs leading-relaxed text-zinc-300">
            <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              Financial-style values are <span className="font-semibold">operational estimates</span>,
              not accounting-posted results.
            </li>
            <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              Demand coverage compares weighted CRM demand vs open PO and delayed in-transit supply
              value proxies.
            </li>
            <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              Revenue-at-risk proxy uses delayed inbound shipments and linked order values.
            </li>
            <li className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              Momentum deltas compare last 30 days against the previous 30-day window.
            </li>
          </ul>
          </article>
        ) : (
          <article className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-6">
            <h2 className="text-lg font-semibold text-white">Investor narrative mode</h2>
            <p className="mt-2 text-sm leading-relaxed text-emerald-50/95">
              This view prioritizes headline outcomes and interventions. Detailed assumptions and deep
              operational lists are intentionally simplified for boardroom storytelling.
            </p>
            <div className="mt-4 text-xs text-emerald-100/90">
              Tip: switch back to operator view for full diagnostics and root-cause detail.
            </div>
          </article>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-5">
        <article className={panelClass}>
          <h2 className="text-lg font-semibold text-white">Order-for org exposure (open PO)</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Phase 5: roll-up of in-scope open parent POs by document <span className="text-zinc-300">served</span> org
            and operating role tags on that org (same dimensions as org settings and PO workflow).
            Totals use the same mixed-currency sum convention as the headline open-PO value.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-400">
                  <th className="py-2 pr-3">Order for</th>
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Operating tags</th>
                  <th className="py-2 pr-3 text-right">Orders</th>
                  <th className="py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="text-zinc-200">
                {summary.openProcurementByServedOrg.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-sm text-zinc-500">
                      No open parent orders in your current view.
                    </td>
                  </tr>
                ) : (
                  summary.openProcurementByServedOrg.map((row, idx) => (
                    <tr key={`served-po-${idx}-${row.servedOrgCode || row.servedOrgName}`} className="border-b border-white/5">
                      <td className="py-2 pr-3 text-white">{row.servedOrgName}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-zinc-400">{row.servedOrgCode || "—"}</td>
                      <td className="max-w-[220px] py-2 pr-3 text-xs text-zinc-300">{row.operatingTagsShort}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.openPoCount}</td>
                      <td className="py-2 text-right tabular-nums text-emerald-200/90">{money(row.openPoValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-5">
        <article className={panelClass}>
          <h2 className="text-lg font-semibold text-white">Decisions for next 7 days</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Suggested executive interventions generated from current risk and momentum signals.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(investorMode ? summary.decisionsNext7Days.slice(0, 3) : summary.decisionsNext7Days).map((d) => (
              <div key={d.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">{d.title}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Owner: {d.owner}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-300">{d.reason}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-6 py-8 sm:grid-cols-2 xl:grid-cols-4">
        {(investorMode
          ? [
              {
                label: "Weighted pipeline",
                value: money(summary.kpis.weightedPipelineValue),
                foot: "CRM opportunities x probability",
                delta: summary.momentum.weightedPipelinePctVsPrev30d,
                goodWhenDown: false,
              },
              {
                label: "Demand coverage",
                value: pct(summary.kpis.demandCoverageRatio),
                foot: "Supply value (open PO + transit) vs weighted demand",
                delta: null,
                goodWhenDown: false,
              },
              {
                label: "Revenue at risk (est.)",
                value: money(summary.kpis.estimatedRevenueAtRisk),
                foot: "Delayed inbound linked order value",
                delta: null,
                goodWhenDown: false,
              },
              {
                label: "Open exceptions",
                value: num(summary.kpis.openExceptions),
                foot: "Control Tower OPEN + IN_PROGRESS",
                delta: summary.momentum.openExceptionsPctVsPrev30d,
                goodWhenDown: true,
              },
            ]
          : [
          {
            label: "Weighted pipeline",
            value: money(summary.kpis.weightedPipelineValue),
            foot: "CRM opportunities x probability",
            delta: summary.momentum.weightedPipelinePctVsPrev30d,
            goodWhenDown: false,
          },
          {
            label: "Open PO commitment",
            value: money(summary.kpis.openPoValue),
            foot: "Open parent purchase orders",
            delta: null,
            goodWhenDown: false,
          },
          {
            label: "Transit value (est.)",
            value: money(summary.kpis.inTransitValueEstimate),
            foot: "Delayed inbound linked PO value",
            delta: null,
            goodWhenDown: false,
          },
          {
            label: "Logistics spend / demand",
            value: pct(summary.kpis.estimatedLogisticsSpendPct),
            foot: `${money(summary.kpis.estimatedLogisticsSpend)} estimated spend`,
            delta: null,
            goodWhenDown: false,
          },
          {
            label: "Demand coverage",
            value: pct(summary.kpis.demandCoverageRatio),
            foot: "Supply value (open PO + transit) vs weighted demand",
            delta: null,
            goodWhenDown: false,
          },
          {
            label: "Revenue at risk (est.)",
            value: money(summary.kpis.estimatedRevenueAtRisk),
            foot: "Delayed inbound linked order value",
            delta: null,
            goodWhenDown: false,
          },
          {
            label: "Open exceptions",
            value: num(summary.kpis.openExceptions),
            foot: "Control Tower OPEN + IN_PROGRESS",
            delta: summary.momentum.openExceptionsPctVsPrev30d,
            goodWhenDown: true,
          },
          {
            label: "Delayed inbound shipments",
            value: num(summary.kpis.delayedInboundShipments),
            foot: "ETA passed and not received",
            delta: summary.momentum.delayedInboundPctVsPrev30d,
            goodWhenDown: true,
          },
          {
            label: "Critical stock-out risks",
            value: num(summary.kpis.criticalStockOutRiskCount),
            foot: "Allocated quantity exceeds on-hand",
            delta: summary.momentum.stockOutRiskPctVsPrev30d,
            goodWhenDown: true,
          },
        ]).map((kpi) => (
          <article
            key={kpi.label}
            className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.28)]"
          >
            <p className="text-sm text-zinc-300">{kpi.label}</p>
            <p className="mt-2 text-3xl font-bold text-white">{kpi.value}</p>
            <p className="mt-3 text-xs text-zinc-400">{kpi.foot}</p>
            <p className={`mt-1 text-xs font-medium ${deltaTone(kpi.delta, kpi.goodWhenDown)}`}>
              {deltaLabel(kpi.delta)}
            </p>
          </article>
        ))}
      </section>

      {!investorMode ? (
        <section className="mx-auto grid max-w-7xl gap-5 px-6 pb-6 lg:grid-cols-[1.35fr,1fr]">
          <article className={`${panelClass} lg:col-span-2`}>
          <h2 className="text-lg font-semibold text-white">Demand vs supply coverage</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Operational view before accounting integration. Values shown in USD-equivalent estimates.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Weighted demand",
                value: summary.kpis.weightedPipelineValue,
                color: "bg-emerald-400/90",
              },
              {
                label: "Open PO supply",
                value: summary.kpis.openPoValue,
                color: "bg-sky-400/90",
              },
              {
                label: "Transit supply (est.)",
                value: summary.kpis.inTransitValueEstimate,
                color: "bg-amber-400/90",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-400">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-white">{money(item.value)}</p>
                <div className="mt-3 h-2 rounded-full bg-zinc-800">
                  <div
                    className={`h-2 rounded-full ${item.color}`}
                    style={{
                      width: `${Math.max(5, (item.value / Math.max(summary.kpis.weightedPipelineValue, summary.kpis.openPoValue + summary.kpis.inTransitValueEstimate, 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
        </section>
      ) : null}

      <section className="mx-auto grid max-w-7xl gap-5 px-6 pb-10 lg:grid-cols-[1.35fr,1fr]">
        {!investorMode ? (
          <article className={panelClass}>
          <h2 className="text-lg font-semibold text-white">6-month executive trend</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Pipeline, open PO commitment, and estimated logistics spend.
          </p>
          <div className="mt-5 space-y-4">
            {summary.trends.map((row) => (
              <div key={row.month} className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{row.month}</span>
                  <span>
                    Pipe {money(row.weightedPipelineValue)} · PO {money(row.openPoValue)}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="h-2 rounded-full bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-emerald-400/90"
                      style={{ width: `${Math.max(3, (row.weightedPipelineValue / maxTrend) * 100)}%` }}
                    />
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-sky-400/90"
                      style={{ width: `${Math.max(3, (row.openPoValue / maxTrend) * 100)}%` }}
                    />
                  </div>
                  <div className="h-2 rounded-full bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-amber-400/90"
                      style={{ width: `${Math.max(3, (row.estimatedLogisticsSpend / maxTrend) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
        ) : (
          <article className={panelClass}>
            <h2 className="text-lg font-semibold text-white">Investor summary trend</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Quick read of momentum across pipeline, supply commitment, and spend pressure.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-zinc-400">Pipeline momentum</p>
                <p
                  className={`mt-2 text-xl font-semibold ${deltaTone(
                    summary.momentum.weightedPipelinePctVsPrev30d,
                    false,
                  )}`}
                >
                  {deltaLabel(summary.momentum.weightedPipelinePctVsPrev30d).replace("vs prior 30d: ", "")}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-zinc-400">Exception momentum</p>
                <p
                  className={`mt-2 text-xl font-semibold ${deltaTone(
                    summary.momentum.openExceptionsPctVsPrev30d,
                    true,
                  )}`}
                >
                  {deltaLabel(summary.momentum.openExceptionsPctVsPrev30d).replace("vs prior 30d: ", "")}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-zinc-400">Delayed inbound momentum</p>
                <p
                  className={`mt-2 text-xl font-semibold ${deltaTone(
                    summary.momentum.delayedInboundPctVsPrev30d,
                    true,
                  )}`}
                >
                  {deltaLabel(summary.momentum.delayedInboundPctVsPrev30d).replace("vs prior 30d: ", "")}
                </p>
              </div>
            </div>
          </article>
        )}

        <article className={panelClass}>
          <h2 className="text-lg font-semibold text-white">Executive action panel</h2>
          <p className="mt-1 text-xs text-zinc-400">Where CEO intervention is needed now.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/srm"
              className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10"
            >
              Supplier risk view
            </Link>
            <Link
              href="/suppliers?kind=logistics"
              className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10"
            >
              Logistics partners
            </Link>
            <Link
              href="/wms/stock"
              className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-white/10"
            >
              Stock ledger
            </Link>
          </div>

          <div className="mt-5 space-y-5">
            <section>
              <h3 className="text-sm font-semibold text-rose-200">Top stock-out risk SKUs</h3>
              <ul className="mt-2 space-y-2 text-sm text-zinc-300">
                {summary.actionPanel.stockOutRisks.length ? (
                  summary.actionPanel.stockOutRisks.map((r) => (
                    <li key={r.productId} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="font-medium text-zinc-100">
                        {r.productCode} · {r.productName}
                      </p>
                      <p className="text-xs text-zinc-400">
                        shortage {num(r.shortageQty)} | avail {num(r.availableQty)} | alloc {num(r.allocatedQty)}
                      </p>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-zinc-400">No critical stock-out risks detected.</li>
                )}
              </ul>
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-amber-200">Top delayed inbound shipments</h3>
                <Link
                  href={controlTowerWorkbenchPath({ onlyOverdueEta: "1", sortBy: "eta_asc" })}
                  className="text-xs font-medium text-amber-100/90 underline decoration-amber-200/35 underline-offset-2 hover:decoration-amber-100"
                >
                  Open in workbench
                </Link>
              </div>
              <ul className="mt-2 space-y-2 text-sm text-zinc-300">
                {summary.actionPanel.delayedInbound.length ? (
                  summary.actionPanel.delayedInbound.map((s) => (
                    <li key={s.shipmentId} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="font-medium text-zinc-100">
                        <Link href={`/control-tower/shipments/${s.shipmentId}`} className="hover:underline">
                          {s.shipmentNo}
                        </Link>{" "}
                        · {s.customer}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {s.delayDays} day(s) late | status {s.status}
                      </p>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-zinc-400">No delayed inbound shipments currently flagged.</li>
                )}
              </ul>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-sky-200">Customers at service risk</h3>
              <ul className="mt-2 space-y-2 text-sm text-zinc-300">
                {summary.actionPanel.customersAtRisk.length ? (
                  summary.actionPanel.customersAtRisk.map((c) => (
                    <li key={c.customer} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <span>{c.customer}</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                        {c.delayedShipmentCount} delayed
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-zinc-400">No customer risk concentration right now.</li>
                )}
              </ul>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-violet-200">Suppliers / forwarders at risk</h3>
              <ul className="mt-2 space-y-2 text-sm text-zinc-300">
                {summary.actionPanel.suppliersAtRisk.length ? (
                  summary.actionPanel.suppliersAtRisk.map((c) => (
                    <li key={c.supplier} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <span>{c.supplier}</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                        {c.delayedShipmentCount} delayed
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-zinc-400">No supplier concentration of delay risk.</li>
                )}
              </ul>
            </section>
          </div>
        </article>
      </section>
    </main>
  );
}
