"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Lead = {
  id: string;
  companyName: string;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
  source: string;
  serviceInterest: string | null;
  qualificationNotes: string | null;
  estimatedAnnualSpend: string | null;
  targetStartDate: string | null;
  convertedAt: string | null;
  convertedAccountId: string | null;
  ownerUserId: string;
  owner: { name: string; email: string };
};

const STATUSES_OPEN = ["NEW", "WORKING", "QUALIFIED", "DISQUALIFIED"] as const;

export function CrmLeadDetail({
  leadId,
  actorUserId,
  canEditAll,
}: {
  leadId: string;
  actorUserId: string;
  canEditAll: boolean;
}) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [status, setStatus] = useState("NEW");
  const [serviceInterest, setServiceInterest] = useState("");
  const [qualificationNotes, setQualificationNotes] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      const l = data.lead as Lead;
      setLead(l);
      setCompanyName(l.companyName);
      setContactFirstName(l.contactFirstName ?? "");
      setContactLastName(l.contactLastName ?? "");
      setContactEmail(l.contactEmail ?? "");
      setContactPhone(l.contactPhone ?? "");
      setStatus(l.status);
      setServiceInterest(l.serviceInterest ?? "");
      setQualificationNotes(l.qualificationNotes ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canPatch = Boolean(
    lead &&
      (canEditAll || lead.ownerUserId === actorUserId) &&
      lead.status !== "CONVERTED",
  );
  const canPatchNotes = Boolean(
    lead &&
      (canEditAll || lead.ownerUserId === actorUserId) &&
      lead.status === "CONVERTED",
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> =
        lead.status === "CONVERTED"
          ? {
              serviceInterest: serviceInterest.trim() || null,
              qualificationNotes: qualificationNotes.trim() || null,
            }
          : {
              companyName: companyName.trim(),
              contactFirstName: contactFirstName.trim() || null,
              contactLastName: contactLastName.trim() || null,
              contactEmail: contactEmail.trim() || null,
              contactPhone: contactPhone.trim() || null,
              status,
              serviceInterest: serviceInterest.trim() || null,
              qualificationNotes: qualificationNotes.trim() || null,
            };
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setLead(data.lead);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/convert`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Convert failed");
      await load();
      if (data.account?.id) {
        window.location.href = `/crm/accounts/${data.account.id}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Convert failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !lead) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-red-700">{error}</p>
        <Link href="/crm/leads" className="mt-4 inline-block text-sm text-violet-700">
          ← Leads
        </Link>
      </div>
    );
  }

  if (!lead) {
    return <div className="px-6 py-16 text-sm text-zinc-500">Loading…</div>;
  }

  const canConvert =
    lead.status !== "CONVERTED" && (canEditAll || lead.ownerUserId === actorUserId);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/crm/leads" className="text-sm font-medium text-violet-700 hover:underline">
          ← Leads
        </Link>
        <span className="text-zinc-300">/</span>
        <h1 className="text-2xl font-semibold text-zinc-900">{lead.companyName}</h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
          {lead.status}
        </span>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {lead.status === "CONVERTED" && lead.convertedAccountId ? (
        <p className="mb-6 text-sm text-zinc-600">
          Converted —{" "}
          <Link
            href={`/crm/accounts/${lead.convertedAccountId}`}
            className="font-medium text-violet-700 hover:underline"
          >
            open account
          </Link>
        </p>
      ) : null}

      <form onSubmit={save} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        {!canPatch && !canPatchNotes ? (
          <p className="text-sm text-zinc-600">You cannot edit this lead.</p>
        ) : null}

        {canPatch ? (
          <>
            <label className="block text-sm">
              <span className="text-zinc-600">Company</span>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                disabled={busy}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-zinc-600">Contact first</span>
                <input
                  value={contactFirstName}
                  onChange={(e) => setContactFirstName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  disabled={busy}
                />
              </label>
              <label className="text-sm">
                <span className="text-zinc-600">Contact last</span>
                <input
                  value={contactLastName}
                  onChange={(e) => setContactLastName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  disabled={busy}
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-zinc-600">Email</span>
                <input
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  disabled={busy}
                />
              </label>
              <label className="text-sm">
                <span className="text-zinc-600">Phone</span>
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  disabled={busy}
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-zinc-600">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                disabled={busy}
              >
                {STATUSES_OPEN.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}

        {(canPatch || canPatchNotes) && (
          <>
            <label className="block text-sm">
              <span className="text-zinc-600">Service interest</span>
              <input
                value={serviceInterest}
                onChange={(e) => setServiceInterest(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                disabled={busy}
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600">Qualification notes</span>
              <textarea
                value={qualificationNotes}
                onChange={(e) => setQualificationNotes(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                disabled={busy}
              />
            </label>
          </>
        )}

        {(canPatch || canPatchNotes) && (
          <button
            type="submit"
            disabled={busy || (canPatch && !companyName.trim())}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Save
          </button>
        )}
      </form>

      {canConvert ? (
        <div className="mt-6">
          <button
            type="button"
            disabled={busy}
            onClick={() => void convert()}
            className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
          >
            Convert to account
          </button>
        </div>
      ) : null}

      <p className="mt-8 text-xs text-zinc-400">
        Owner: {lead.owner.name} · Source: {lead.source}
      </p>
    </div>
  );
}
