"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function InvoiceReviewScaffold(props: {
  intakeId: string;
  canEdit: boolean;
  status: string;
  reviewDecision: string;
  disabledReason?: string | null;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<"APPROVED" | "OVERRIDDEN">("APPROVED");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canUse = props.canEdit && props.status === "AUDITED";
  const blocked = props.disabledReason ?? (!canUse ? "Run a successful audit before recording approval or override." : null);

  async function submit() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/invoice-audit/intakes/${props.intakeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewDecision: decision,
          reviewNote: note.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setOk(decision === "APPROVED" ? "Approval recorded." : "Override recorded.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Manual review</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Finance sign-off for this intake. <span className="font-medium text-zinc-800">Approve</span> when the audit
        outcome is acceptable; choose <span className="font-medium text-zinc-800">Override</span> to record acceptance
        with a documented exception (note is recommended). This does not change parsed lines or re-run matching — it
        only stores the decision on the intake for audit trail.
      </p>

      {props.reviewDecision !== "NONE" ? (
        <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800">
          Current decision: <span className="font-semibold">{props.reviewDecision}</span>
        </p>
      ) : null}

      {blocked ? <p className="mt-3 text-sm text-amber-800">{blocked}</p> : null}

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="decision"
              checked={decision === "APPROVED"}
              disabled={!canUse}
              onChange={() => setDecision("APPROVED")}
            />
            Approve (match acceptable)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="decision"
              checked={decision === "OVERRIDDEN"}
              disabled={!canUse}
              onChange={() => setDecision("OVERRIDDEN")}
            />
            Override (accepted with documented exception)
          </label>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Note</label>
          <textarea
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-inner disabled:opacity-50"
            rows={3}
            disabled={!canUse}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason, ticket id, or settlement reference…"
          />
        </div>
        <button
          type="button"
          disabled={!canUse || busy}
          onClick={() => void submit()}
          className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save decision"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="mt-3 text-sm text-emerald-800">{ok}</p> : null}
    </section>
  );
}
