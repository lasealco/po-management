"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const STAGES = [
  "IDENTIFIED",
  "QUALIFIED",
  "DISCOVERY",
  "SOLUTION_DESIGN",
  "PROPOSAL_SUBMITTED",
  "NEGOTIATION",
  "VERBAL_AGREEMENT",
  "WON_IMPLEMENTATION_PENDING",
  "WON_LIVE",
  "LOST",
  "ON_HOLD",
] as const;

type ContactOpt = { id: string; firstName: string; lastName: string };

type Opp = {
  id: string;
  name: string;
  stage: string;
  probability: number;
  forecastCategory: string | null;
  estimatedRevenue: string | null;
  currency: string | null;
  closeDate: string | null;
  nextStep: string | null;
  nextStepDate: string | null;
  primaryContactId: string | null;
  competitorName: string | null;
  lostReason: string | null;
  accountId: string;
  ownerUserId: string;
  account: { id: string; name: string };
  primaryContact: ContactOpt | null;
};

type ActRow = {
  id: string;
  type: string;
  subject: string;
  status: string;
  dueDate: string | null;
};

export function CrmOpportunityDetail({
  opportunityId,
  actorUserId,
  canEditAll,
}: {
  opportunityId: string;
  actorUserId: string;
  canEditAll: boolean;
}) {
  const [opportunity, setOpportunity] = useState<Opp | null>(null);
  const [activities, setActivities] = useState<ActRow[]>([]);
  const [contacts, setContacts] = useState<ContactOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [stage, setStage] = useState<string>("IDENTIFIED");
  const [probability, setProbability] = useState(10);
  const [closeDate, setCloseDate] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [estimatedRevenue, setEstimatedRevenue] = useState("");
  const [primaryContactId, setPrimaryContactId] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/crm/opportunities/${opportunityId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      const o = data.opportunity as Opp;
      setOpportunity(o);
      setActivities(data.activities ?? []);
      setName(o.name);
      setStage(o.stage);
      setProbability(o.probability);
      setCloseDate(
        o.closeDate ? new Date(o.closeDate).toISOString().slice(0, 10) : "",
      );
      setNextStep(o.nextStep ?? "");
      setEstimatedRevenue(o.estimatedRevenue ?? "");
      setPrimaryContactId(o.primaryContactId ?? "");

      const cRes = await fetch(`/api/crm/contacts?accountId=${o.accountId}`);
      const cData = await cRes.json();
      if (cRes.ok) {
        setContacts(
          (cData.contacts ?? []).map((c: ContactOpt) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
          })),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [opportunityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!opportunity) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          stage,
          probability,
          closeDate: closeDate.trim() || null,
          nextStep: nextStep.trim() || null,
          estimatedRevenue: estimatedRevenue.trim() || null,
          primaryContactId: primaryContactId.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setOpportunity(data.opportunity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !opportunity) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-red-700">{error}</p>
        <Link href="/crm/pipeline" className="mt-4 inline-block text-sm text-violet-700">
          ← Pipeline
        </Link>
      </div>
    );
  }

  if (!opportunity) {
    return <div className="px-6 py-16 text-sm text-zinc-500">Loading…</div>;
  }

  const canPatch = canEditAll || opportunity.ownerUserId === actorUserId;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/crm/pipeline" className="text-sm font-medium text-violet-700 hover:underline">
          ← Pipeline
        </Link>
        <span className="text-zinc-300">/</span>
        <h1 className="text-2xl font-semibold text-zinc-900">{opportunity.name}</h1>
      </div>
      <p className="mb-6 text-sm text-zinc-600">
        Account:{" "}
        <Link
          href={`/crm/accounts/${opportunity.account.id}`}
          className="font-medium text-violet-700 hover:underline"
        >
          {opportunity.account.name}
        </Link>
      </p>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {canPatch ? (
        <form onSubmit={save} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <label className="block text-sm">
            <span className="text-zinc-600">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Stage</span>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Probability (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={probability}
              onChange={(e) => setProbability(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Close date</span>
            <input
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Estimated revenue</span>
            <input
              value={estimatedRevenue}
              onChange={(e) => setEstimatedRevenue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Primary contact</span>
            <select
              value={primaryContactId}
              onChange={(e) => setPrimaryContactId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            >
              <option value="">—</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Next step</span>
            <textarea
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Save
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-600">Read-only for this user.</p>
      )}

      <section className="mt-10">
        <h2 className="mb-2 text-lg font-semibold text-zinc-900">Linked activities</h2>
        <ul className="rounded-xl border border-zinc-200 bg-white text-sm shadow-sm">
          {activities.length === 0 ? (
            <li className="px-4 py-6 text-zinc-500">None yet.</li>
          ) : (
            activities.map((a) => (
              <li key={a.id} className="border-b border-zinc-100 px-4 py-2 last:border-0">
                <span className="font-medium text-zinc-900">{a.subject}</span>
                <span className="text-zinc-500"> · {a.type}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
