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

function needsComplianceFollowUp(outcome: SupplierComplianceReviewOutcome): boolean {
  return outcome === "action_required" || outcome === "failed";
}

function nextReviewDueInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Stable remount key for uncontrolled summary fields after PATCH. */
function complianceReviewSummaryFieldKey(id: string, summary: string, nextDue: string | null): string {
  let h = 0;
  for (let i = 0; i < summary.length; i++) h = (h * 31 + summary.charCodeAt(i)) | 0;
  return `${id}-sm-${h}-${nextDue ?? ""}`;
}

export function SupplierComplianceReviewsSection({
  supplierId,
  canEdit,
  initialRows,
  /** When set, follow-up strip can jump to Documents or Risk (SRM tab or legacy scroll). */
  onWorkspaceNavigate,
}: {
  supplierId: string;
  canEdit: boolean;
  initialRows: SupplierComplianceReviewRow[];
  onWorkspaceNavigate?: (tab: "documents" | "risk") => void;
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
    <section
      id="supplier-compliance-reviews-section"
      className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-zinc-900">Compliance reviews</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Periodic controls workspace (separate from onboarding). Record outcomes, dates, and narrative;
        for <strong className="font-medium">Action required</strong> or <strong className="font-medium">Failed</strong>, use the suggested follow-up steps below — no separate action-plan table in R1.
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
                <div className="min-w-0 flex-1 space-y-2">
                  {canEdit ? (
                    <label className="block text-xs text-zinc-600">
                      Summary
                      <textarea
                        key={complianceReviewSummaryFieldKey(r.id, r.summary, r.nextReviewDue)}
                        defaultValue={r.summary}
                        disabled={busyId === r.id}
                        rows={3}
                        className={f}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v === r.summary.trim()) return;
                          if (!v) {
                            e.target.value = r.summary;
                            return;
                          }
                          void patchReview(r.id, { summary: v });
                        }}
                      />
                    </label>
                  ) : (
                    <p className="text-sm text-zinc-800">{r.summary}</p>
                  )}
                  <p className="text-[11px] text-zinc-500">
                    Reviewed {new Date(r.reviewedAt).toLocaleString()}
                    {!canEdit && r.nextReviewDue
                      ? ` · Next due ${new Date(r.nextReviewDue).toLocaleDateString()}`
                      : null}
                  </p>
                  {canEdit ? (
                    <label className="block text-xs text-zinc-600">
                      Next review due
                      <input
                        type="date"
                        key={`${r.id}-due-${r.nextReviewDue ?? "none"}`}
                        defaultValue={nextReviewDueInputValue(r.nextReviewDue)}
                        disabled={busyId === r.id}
                        className={f}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const prev = nextReviewDueInputValue(r.nextReviewDue);
                          if (v === prev) return;
                          void patchReview(
                            r.id,
                            v ? { nextReviewDue: new Date(v).toISOString() } : { nextReviewDue: null },
                          );
                        }}
                      />
                    </label>
                  ) : null}
                  {needsComplianceFollowUp(r.outcome) ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-950">
                      <p className="font-semibold text-amber-950">Suggested follow-up</p>
                      <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                        <li>Update evidence under Documents if the review noted gaps.</li>
                        <li>Log or adjust a Risk row if exposure or severity changed.</li>
                        <li>When cleared, set outcome to Satisfactory or add a new review entry.</li>
                      </ol>
                      {onWorkspaceNavigate ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100/80"
                            onClick={() => onWorkspaceNavigate("documents")}
                          >
                            Documents
                          </button>
                          <button
                            type="button"
                            className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100/80"
                            onClick={() => onWorkspaceNavigate("risk")}
                          >
                            Risk
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
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
                  <span className="text-xs font-medium text-zinc-600">
                    {OUTCOMES.find((o) => o.value === r.outcome)?.label ?? r.outcome}
                  </span>
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
