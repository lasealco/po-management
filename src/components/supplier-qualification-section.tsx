"use client";

import type { SupplierQualificationStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const STATUS_OPTIONS: { value: SupplierQualificationStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "qualified", label: "Qualified" },
  { value: "conditional", label: "Conditional" },
  { value: "disqualified", label: "Disqualified" },
];

function statusLabel(s: SupplierQualificationStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

export function SupplierQualificationSection({
  supplierId,
  canEdit,
  qualification,
}: {
  supplierId: string;
  canEdit: boolean;
  qualification: {
    status: SupplierQualificationStatus;
    summary: string | null;
    lastReviewedAt: string | null;
    suggestedStatus: SupplierQualificationStatus;
  };
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SupplierQualificationStatus>(qualification.status);
  const [summary, setSummary] = useState(qualification.summary ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(qualification.status);
    setSummary(qualification.summary ?? "");
  }, [qualification.status, qualification.summary, qualification.lastReviewedAt]);

  async function save() {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/suppliers/${supplierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qualificationStatus: status,
        qualificationSummary: summary.trim() || null,
        qualificationLastReviewedAt: new Date().toISOString(),
      }),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Save failed.");
      return;
    }
    setBusy(false);
    router.refresh();
  }

  async function applyChecklistSuggestion() {
    setError(null);
    setBusy(true);
    const next = qualification.suggestedStatus;
    const res = await fetch(`/api/suppliers/${supplierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qualificationStatus: next,
        qualificationSummary: summary.trim() || null,
        qualificationLastReviewedAt: new Date().toISOString(),
      }),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Could not apply suggestion.");
      return;
    }
    setStatus(next);
    setBusy(false);
    router.refresh();
  }

  const f =
    "mt-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400";

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Qualification</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Record the buyer decision on this supplier. The onboarding checklist suggests a status from task
        completion; it does not overwrite your recorded state.
      </p>
      <div className="mt-3 flex flex-col gap-2 rounded-md border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-medium">Checklist suggests:</span>{" "}
          {statusLabel(qualification.suggestedStatus)}
        </p>
        {canEdit && qualification.suggestedStatus !== qualification.status ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void applyChecklistSuggestion()}
            className="shrink-0 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            Apply suggestion
          </button>
        ) : null}
      </div>
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <div className="mt-4 space-y-4">
        <label className="flex flex-col text-sm">
          <span className="text-zinc-700">Recorded status</span>
          <select
            value={status}
            disabled={!canEdit || busy}
            onChange={(e) => setStatus(e.target.value as SupplierQualificationStatus)}
            className={f}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm">
          <span className="text-zinc-700">Summary / conditions</span>
          <textarea
            value={summary}
            disabled={!canEdit || busy}
            onChange={(e) => setSummary(e.target.value)}
            rows={5}
            placeholder="e.g. Approved for indirect materials; annual re-qualification required."
            className={f}
          />
        </label>
        {qualification.lastReviewedAt ? (
          <p className="text-xs text-zinc-500">
            Last reviewed {new Date(qualification.lastReviewedAt).toLocaleString()}
          </p>
        ) : (
          <p className="text-xs text-zinc-500">Not yet reviewed on record.</p>
        )}
        {canEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save qualification"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
