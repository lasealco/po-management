"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatInvoiceAuditApiError } from "@/lib/invoice-audit/invoice-audit-api-client-error";
import {
  canRecordFinanceReview,
  financeReviewBlockedExplanation,
} from "@/lib/invoice-audit/finance-review-eligibility";

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

  const gateInput = {
    status: props.status,
    disabledReason:
      props.disabledReason ??
      (!props.canEdit ? "View only — finance review requires edit access." : null),
  };
  const canUse = props.canEdit && canRecordFinanceReview(gateInput);
  const blocked = financeReviewBlockedExplanation(gateInput);

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
      const data = (await res.json().catch(() => ({}))) as Parameters<typeof formatInvoiceAuditApiError>[0];
      if (!res.ok) {
        setError(formatInvoiceAuditApiError(data, res.status));
        return;
      }
      setOk(decision === "APPROVED" ? "Approval recorded." : "Override recorded.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="invoice-audit-finance-review" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Closeout · Step 2</p>
      <h2 className="mt-1 text-sm font-semibold text-zinc-900">Finance review</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Commercial sign-off after audit (separate from line-level GREEN/AMBER/RED and from{" "}
        <span className="font-medium text-zinc-800">tolerance rules</span>, which only affect how amounts classify during{" "}
        <span className="font-medium text-zinc-800">Run audit</span>). Saving here does not change parsed lines or
        re-run matching — it records who accepted what on this intake.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-600">
        <li>
          <span className="font-medium text-zinc-800">Approve</span> — audit outcome is commercially acceptable as shown
          (rollup and line outcomes stay as-is).
        </li>
        <li>
          <span className="font-medium text-zinc-800">Override</span> — you still accept the invoice for processing, but
          document why (variance, dispute settlement, policy exception). A note is strongly recommended; both Approve
          and Override are explicit finance decisions.
        </li>
      </ul>
      <p className="mt-2 text-xs text-zinc-500">
        Saving any new decision clears <span className="font-medium text-zinc-700">accounting handoff</span> (Step 3)
        so downstream posting is never tied to an outdated review — complete Step 3 again when ready.
      </p>

      {props.reviewDecision !== "NONE" ? (
        <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-800">
          Current decision:{" "}
          <span className="font-semibold">
            {props.reviewDecision === "APPROVED"
              ? "APPROVED (Approve)"
              : props.reviewDecision === "OVERRIDDEN"
                ? "OVERRIDDEN (Override)"
                : props.reviewDecision}
          </span>
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
            Approve (commercially acceptable as audited)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="decision"
              checked={decision === "OVERRIDDEN"}
              disabled={!canUse}
              onChange={() => setDecision("OVERRIDDEN")}
            />
            Override (accepted with documented exception — note recommended)
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
