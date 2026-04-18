"use client";

import type { SupplierComplianceReviewOutcome } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type SupplierComplianceReviewRow = {
  id: string;
  outcome: SupplierComplianceReviewOutcome;
  summary: string;
  reviewedAt: string;
  nextReviewDue: string | null;
};

const OUTCOMES: { value: SupplierComplianceReviewOutcome; label: string }[] = [
  { value: "satisfactory", label: "Satisfactory" },
  { value: "action_required", label: "Action required" },
  { value: "failed", label: "Failed" },
];

export function SupplierComplianceReviewsSection({
  supplierId,
  canEdit,
  initialRows,
}: {
  supplierId: string;
  canEdit: boolean;
  initialRows: SupplierComplianceReviewRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [outcome, setOutcome] = useState<SupplierComplianceReviewOutcome>("satisfactory");
  const [summary, setSummary] = useState("");
  const [nextDue, setNextDue] = useState("");

  async function addReview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!summary.trim()) {
      setError("Summary is required.");
      return;
    }
    setBusy(true);
    const body: Record<string, unknown> = {
      outcome,
      summary: summary.trim(),
    };
    if (nextDue.trim()) {
      body.nextReviewDue = new Date(nextDue).toISOString();
    }
    const res = await fetch(`/api/suppliers/${supplierId}/compliance-reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await res.json()) as { error?: string; review?: SupplierComplianceReviewRow };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Could not add review.");
      return;
    }
    if (payload.review) setRows((prev) => [payload.review!, ...prev]);
    setSummary("");
    setNextDue("");
    setBusy(false);
    router.refresh();
  }

  async function patchReview(id: string, patch: Record<string, unknown>) {
    setError(null);
    setBusyId(id);
    const res = await fetch(`/api/suppliers/${supplierId}/compliance-reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = (await res.json()) as { error?: string; review?: SupplierComplianceReviewRow };
    if (!res.ok) {
      setBusyId(null);
      setError(payload.error ?? "Update failed.");
      return;
    }
    if (payload.review) {
      setRows((prev) => prev.map((r) => (r.id === id ? payload.review! : r)));
    }
    setBusyId(null);
    router.refresh();
  }

  const f =
    "mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-50";

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Compliance reviews</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Log periodic controls / compliance reviews (separate from the onboarding checklist). Use for
        audits, policy attestations, and corrective actions.
      </p>
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <ul className="mt-4 divide-y divide-zinc-100 border border-zinc-100 rounded-md">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">No reviews recorded yet.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm text-zinc-800">{r.summary}</p>
                  <p className="text-[11px] text-zinc-500">
                    Reviewed {new Date(r.reviewedAt).toLocaleString()}
                    {r.nextReviewDue ? ` · Next due ${new Date(r.nextReviewDue).toLocaleDateString()}` : ""}
                  </p>
                </div>
                {canEdit ? (
                  <select
                    value={r.outcome}
                    disabled={busyId === r.id}
                    onChange={(e) => {
                      const v = e.target.value as SupplierComplianceReviewOutcome;
                      void patchReview(r.id, { outcome: v });
                    }}
                    className={`${f} sm:w-44`}
                  >
                    {OUTCOMES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-medium text-zinc-600">{r.outcome}</span>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
      {canEdit ? (
        <form onSubmit={addReview} className="mt-6 space-y-3 rounded-md border border-dashed border-zinc-300 p-4">
          <p className="text-sm font-medium text-zinc-800">Add review</p>
          <label className="flex flex-col text-sm">
            <span>Outcome</span>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as SupplierComplianceReviewOutcome)} className={f}>
              {OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-sm">
            <span>Summary *</span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className={f}
              placeholder="What was reviewed, evidence, follow-ups…"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span>Next review due (optional)</span>
            <input
              type="date"
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
              className={f}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            {busy ? "Saving…" : "Record review"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
