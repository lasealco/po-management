"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Summary = {
  leads: number;
  accounts: number;
  openOpportunities: number;
  openActivities: number;
};

type LeadRow = {
  id: string;
  companyName: string;
  status: string;
  source: string;
  contactEmail: string | null;
  ownerUserId: string;
  owner: { name: string; email: string };
  updatedAt: string;
};

type AccountRow = {
  id: string;
  name: string;
  accountType: string;
  lifecycle: string;
  strategicFlag: boolean;
  owner: { name: string };
  _count: { contacts: number; opportunities: number };
};

type OppRow = {
  id: string;
  name: string;
  stage: string;
  probability: number;
  estimatedRevenue: string | null;
  currency: string | null;
  closeDate: string | null;
  nextStep: string | null;
  account: { id: string; name: string };
};

export function CrmClient({
  canEdit,
  actorUserId,
}: {
  canEdit: boolean;
  actorUserId: string;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [opportunities, setOpportunities] = useState<OppRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [leadCompany, setLeadCompany] = useState("");
  const [accountName, setAccountName] = useState("");
  const [oppAccountId, setOppAccountId] = useState("");
  const [oppName, setOppName] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, l, a, o] = await Promise.all([
        fetch("/api/crm/summary").then((r) => r.json()),
        fetch("/api/crm/leads").then((r) => r.json()),
        fetch("/api/crm/accounts").then((r) => r.json()),
        fetch("/api/crm/opportunities").then((r) => r.json()),
      ]);
      if (s.error) throw new Error(s.error);
      if (l.error) throw new Error(l.error);
      if (a.error) throw new Error(a.error);
      if (o.error) throw new Error(o.error);
      setSummary(s);
      setLeads(l.leads ?? []);
      const acc = a.accounts ?? [];
      setAccounts(acc);
      setOpportunities(o.opportunities ?? []);
      setOppAccountId((prev) => prev || acc[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load CRM");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    if (!leadCompany.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: leadCompany.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setLeadCompany("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!accountName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: accountName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setAccountName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addOpportunity(e: React.FormEvent) {
    e.preventDefault();
    if (!oppAccountId || !oppName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: oppAccountId,
          name: oppName.trim(),
          stage: "IDENTIFIED",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setOppName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function convertLead(leadId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/convert`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Convert failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Convert failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            CRM
          </h1>
          <p className="text-sm text-zinc-600">
            Leads, accounts, and opportunities (R1). Scoped to your tenant;{" "}
            {canEdit
              ? "you can see all tenant CRM records."
              : "you see records you own."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="self-start rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Leads", summary.leads],
            ["Accounts", summary.accounts],
            ["Open pipeline (opps)", summary.openOpportunities],
            ["Open activities", summary.openActivities],
          ].map(([label, n]) => (
            <div
              key={String(label)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900">{n}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">New lead</h2>
          <form onSubmit={addLead} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">
              <span className="text-zinc-600">Company</span>
              <input
                value={leadCompany}
                onChange={(e) => setLeadCompany(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                placeholder="Shipper or prospect name"
                disabled={busy}
              />
            </label>
            <button
              type="submit"
              disabled={busy || !leadCompany.trim()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Save lead
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">New account</h2>
          <form
            onSubmit={addAccount}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <label className="flex-1 text-sm">
              <span className="text-zinc-600">Account name</span>
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                placeholder="Customer / prospect legal or trade name"
                disabled={busy}
              />
            </label>
            <button
              type="submit"
              disabled={busy || !accountName.trim()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Save account
            </button>
          </form>
        </section>
      </div>

      <section className="mt-10 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">New opportunity</h2>
        <form
          onSubmit={addOpportunity}
          className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end"
        >
          <label className="text-sm">
            <span className="text-zinc-600">Account</span>
            <select
              value={oppAccountId}
              onChange={(e) => setOppAccountId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy || accounts.length === 0}
            >
              {accounts.length === 0 ? (
                <option value="">Create an account first</option>
              ) : (
                accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-zinc-600">Opportunity name</span>
            <input
              value={oppName}
              onChange={(e) => setOppName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              placeholder="e.g. Chicago warehousing — 2026"
              disabled={busy}
            />
          </label>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={busy || !oppAccountId || !oppName.trim()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Save opportunity
            </button>
          </div>
        </form>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">Leads</h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Owner</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                      No leads yet.
                    </td>
                  </tr>
                ) : (
                  leads.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-50 last:border-0">
                      <td className="px-3 py-2 font-medium text-zinc-900">
                        <Link
                          href={`/crm/leads/${row.id}`}
                          className="text-violet-700 hover:text-violet-900 hover:underline"
                        >
                          {row.companyName}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{row.status}</td>
                      <td className="px-3 py-2 text-zinc-600">{row.owner.name}</td>
                      <td className="px-3 py-2 text-right">
                        {row.status !== "CONVERTED" &&
                        (canEdit || row.ownerUserId === actorUserId) ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void convertLead(row.id)}
                            className="text-sm font-medium text-violet-700 hover:text-violet-900 disabled:opacity-50"
                          >
                            Convert
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">Accounts</h2>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Contacts / Opps</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-zinc-500">
                      No accounts yet.
                    </td>
                  </tr>
                ) : (
                  accounts.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-50 last:border-0">
                      <td className="px-3 py-2 font-medium text-zinc-900">
                        <Link
                          href={`/crm/accounts/${row.id}`}
                          className="text-violet-700 hover:text-violet-900 hover:underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{row.accountType}</td>
                      <td className="px-3 py-2 text-zinc-600">
                        {row._count.contacts} / {row._count.opportunities}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-zinc-900">Opportunities</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">%</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                    No opportunities yet.
                  </td>
                </tr>
              ) : (
                opportunities.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-50 last:border-0">
                    <td className="px-3 py-2 font-medium text-zinc-900">
                      <Link
                        href={`/crm/opportunities/${row.id}`}
                        className="text-violet-700 hover:text-violet-900 hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-zinc-600">{row.account.name}</td>
                    <td className="px-3 py-2 text-zinc-600">{row.stage}</td>
                    <td className="px-3 py-2 text-zinc-600">{row.probability}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-10 text-center text-xs text-zinc-400">
        More views: use the CRM bar (Leads, Accounts, Contacts, Pipeline, Activities). Full
        PRD scope (Outlook, quotes, control tower) is phased — see{" "}
        <code className="rounded bg-zinc-100 px-1">docs/crm/BACKLOG.md</code>.
      </p>
    </div>
  );
}
