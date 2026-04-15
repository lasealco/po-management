"use client";

import { useEffect, useState } from "react";

type CrmSummary = {
  leads: number;
  accounts: number;
  openOpportunities: number;
  openActivities: number;
  openQuotes: number;
  staleOpportunities: number;
  overdueActivities: number;
};

function tile(label: string, value: number, hint: string, tone: "default" | "warn" = "default") {
  return (
    <li
      key={label}
      className={`rounded-xl border px-4 py-3 shadow-sm ${
        tone === "warn" ? "border-amber-300 bg-amber-50/80" : "border-zinc-200 bg-zinc-50/80"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{value}</p>
      <p className="mt-1 text-xs text-zinc-600">{hint}</p>
    </li>
  );
}

export function CrmReportingOverview() {
  const [data, setData] = useState<CrmSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function run() {
      setErr(null);
      try {
        const res = await fetch("/api/crm/summary");
        const j = (await res.json()) as Partial<CrmSummary> & { error?: string };
        if (!res.ok) throw new Error(j.error || res.statusText);
        if (!active) return;
        setData({
          leads: Number(j.leads ?? 0),
          accounts: Number(j.accounts ?? 0),
          openOpportunities: Number(j.openOpportunities ?? 0),
          openActivities: Number(j.openActivities ?? 0),
          openQuotes: Number(j.openQuotes ?? 0),
          staleOpportunities: Number(j.staleOpportunities ?? 0),
          overdueActivities: Number(j.overdueActivities ?? 0),
        });
      } catch (e) {
        if (!active) return;
        setErr(e instanceof Error ? e.message : "Failed to load CRM overview.");
      }
    }
    void run();
    return () => {
      active = false;
    };
  }, []);

  if (err) return <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>;
  if (!data) return <p className="rounded border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">Loading CRM summary…</p>;

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-zinc-900">Live CRM at a glance</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tile("Leads", data.leads, "Tracked in CRM workspace")}
        {tile("Accounts", data.accounts, "Customer/prospect entities")}
        {tile("Open opportunities", data.openOpportunities, "Active pipeline")}
        {tile("Open activities", data.openActivities, "Tasks/calls/meetings")}
        {tile("Open quotes", data.openQuotes, "Draft or sent")}
        {tile(
          "Stale opportunities",
          data.staleOpportunities,
          "Past close or next step date",
          data.staleOpportunities > 0 ? "warn" : "default",
        )}
        {tile(
          "Overdue activities",
          data.overdueActivities,
          "Work items due in the past",
          data.overdueActivities > 0 ? "warn" : "default",
        )}
      </ul>
    </section>
  );
}
