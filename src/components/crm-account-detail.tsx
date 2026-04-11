"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AccountDetail = {
  id: string;
  name: string;
  legalName: string | null;
  website: string | null;
  accountType: string;
  lifecycle: string;
  industry: string | null;
  segment: string | null;
  strategicFlag: boolean;
  ownerUserId: string;
};

type ContactRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  decisionRole: string | null;
};

type OppRow = {
  id: string;
  name: string;
  stage: string;
  probability: number;
  closeDate: string | null;
  nextStep: string | null;
};

type ActRow = {
  id: string;
  type: string;
  subject: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
};

export function CrmAccountDetail({
  accountId,
  actorUserId,
  canEditAll,
}: {
  accountId: string;
  actorUserId: string;
  canEditAll: boolean;
}) {
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [opportunities, setOpportunities] = useState<OppRow[]>([]);
  const [activities, setActivities] = useState<ActRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [strategic, setStrategic] = useState(false);

  const [cFirst, setCFirst] = useState("");
  const [cLast, setCLast] = useState("");
  const [cEmail, setCEmail] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/crm/accounts/${accountId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      setAccount(data.account);
      setName(data.account.name);
      setIndustry(data.account.industry ?? "");
      setStrategic(data.account.strategicFlag);
      setContacts(data.contacts ?? []);
      setOpportunities(data.opportunities ?? []);
      setActivities(data.activities ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry: industry.trim() || null,
          strategicFlag: strategic,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setAccount(data.account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!cFirst.trim() || !cLast.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          firstName: cFirst.trim(),
          lastName: cLast.trim(),
          email: cEmail.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setCFirst("");
      setCLast("");
      setCEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !account) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-red-700">{error}</p>
        <Link href="/crm" className="mt-4 inline-block text-sm text-violet-700">
          ← Back to CRM
        </Link>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  const canPatch = canEditAll || account.ownerUserId === actorUserId;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/crm"
          className="text-sm font-medium text-violet-700 hover:text-violet-900"
        >
          ← CRM home
        </Link>
        <span className="text-zinc-300">/</span>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {account.name}
        </h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
          {account.accountType}
        </span>
        {account.strategicFlag ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
            Strategic
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <section className="mb-10 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Account summary</h2>
        {canPatch ? (
          <form onSubmit={saveAccount} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="text-zinc-600">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                disabled={busy}
              />
            </label>
            <label className="text-sm">
              <span className="text-zinc-600">Industry</span>
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                disabled={busy}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={strategic}
                onChange={(e) => setStrategic(e.target.checked)}
                disabled={busy}
              />
              <span className="text-zinc-700">Strategic account</span>
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Save changes
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">Read-only for this user.</p>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Contacts</h2>
          {canPatch ? (
            <form onSubmit={addContact} className="mt-4 grid gap-2 sm:grid-cols-3">
              <input
                placeholder="First"
                value={cFirst}
                onChange={(e) => setCFirst(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                disabled={busy}
              />
              <input
                placeholder="Last"
                value={cLast}
                onChange={(e) => setCLast(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                disabled={busy}
              />
              <input
                placeholder="Email"
                value={cEmail}
                onChange={(e) => setCEmail(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm sm:col-span-3"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !cFirst.trim() || !cLast.trim()}
                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50 sm:col-span-3"
              >
                Add contact
              </button>
            </form>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">
              You can view contacts but cannot add them on accounts you do not own.
            </p>
          )}
          <ul className="mt-4 divide-y divide-zinc-100 text-sm">
            {contacts.length === 0 ? (
              <li className="py-3 text-zinc-500">No contacts yet.</li>
            ) : (
              contacts.map((c) => (
                <li key={c.id} className="py-2">
                  <span className="font-medium text-zinc-900">
                    {c.firstName} {c.lastName}
                  </span>
                  {c.title ? (
                    <span className="text-zinc-500"> · {c.title}</span>
                  ) : null}
                  {c.email ? (
                    <div className="text-xs text-zinc-500">{c.email}</div>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Opportunities</h2>
          <ul className="mt-4 divide-y divide-zinc-100 text-sm">
            {opportunities.length === 0 ? (
              <li className="py-3 text-zinc-500">No opportunities on this account.</li>
            ) : (
              opportunities.map((o) => (
                <li key={o.id} className="py-2">
                  <div className="font-medium text-zinc-900">{o.name}</div>
                  <div className="text-xs text-zinc-500">
                    {o.stage} · {o.probability}%
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="mt-10 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Recent activities</h2>
        <ul className="mt-4 divide-y divide-zinc-100 text-sm">
          {activities.length === 0 ? (
            <li className="py-3 text-zinc-500">No activities linked to this account.</li>
          ) : (
            activities.map((a) => (
              <li key={a.id} className="py-2">
                <span className="font-medium text-zinc-800">{a.subject}</span>
                <span className="text-zinc-500"> · {a.type}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
