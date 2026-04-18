"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatInvoiceAuditApiError } from "@/lib/invoice-audit/invoice-audit-api-client-error";
import {
  accountingHandoffBlockedExplanation,
  canRecordAccountingHandoff,
} from "@/lib/invoice-audit/accounting-handoff-eligibility";

export function InvoiceAccountingHandoffScaffold(props: {
  intakeId: string;
  canEdit: boolean;
  status: string;
  reviewDecision: string;
  approvedForAccounting: boolean;
  accountingApprovedAt: string | null;
  accountingApprovalNote: string | null;
  disabledReason?: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const gateInput = {
    status: props.status,
    reviewDecision: props.reviewDecision,
    disabledReason:
      props.disabledReason ??
      (!props.canEdit ? "View only — accounting handoff requires edit access." : null),
  };
  const canUse = props.canEdit && canRecordAccountingHandoff(gateInput);
  const blocked = accountingHandoffBlockedExplanation(gateInput);

  async function submit(next: boolean) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/invoice-audit/intakes/${props.intakeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvedForAccounting: next,
          accountingApprovalNote: next ? note.trim() || null : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Parameters<typeof formatInvoiceAuditApiError>[0];
      if (!res.ok) {
        setError(formatInvoiceAuditApiError(data, res.status));
        return;
      }
      setOk(next ? "Marked ready for accounting." : "Accounting handoff cleared.");
      if (!next) setNote("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="invoice-audit-accounting-handoff" className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Closeout · Step 3</p>
      <h2 className="mt-1 text-sm font-semibold text-zinc-900">Accounting handoff</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Use only after <span className="font-medium text-zinc-800">Step 2 — Finance review</span> is saved as either{" "}
        <span className="font-medium text-zinc-800">Approve</span> or <span className="font-medium text-zinc-800">Override</span>{" "}
        (both unlock this step). This flag means “downstream accounting/posting may proceed” — it does not post to ERP
        by itself and it is not a substitute for finance sign-off.
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        Optional reference (GL, batch id, ticket) helps your ops handoff. Re-running audit or saving a new finance
        decision clears the flag so handoff never stays attached to stale review state.
      </p>

      {props.approvedForAccounting ? (
        <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-950 ring-1 ring-sky-200">
          <span className="font-semibold">Ready for accounting</span>
          {props.accountingApprovedAt ? (
            <span className="mt-1 block text-xs font-normal text-sky-900/90">
              Marked {new Date(props.accountingApprovedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </span>
          ) : null}
          {props.accountingApprovalNote ? (
            <span className="mt-1 block text-xs text-sky-900/90">Note: {props.accountingApprovalNote}</span>
          ) : null}
        </p>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">Not yet marked ready for accounting.</p>
      )}

      {blocked ? <p className="mt-3 text-sm text-amber-800">{blocked}</p> : null}

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Reference note (optional)
          </label>
          <textarea
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-inner disabled:opacity-50"
            rows={2}
            disabled={!canUse || busy || props.approvedForAccounting}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. GL 4400 · batch POST-2026-0412"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canUse || busy || props.approvedForAccounting}
            onClick={() => void submit(true)}
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Mark ready for accounting"}
          </button>
          {props.approvedForAccounting ? (
            <button
              type="button"
              disabled={!canUse || busy}
              onClick={() => void submit(false)}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
            >
              Clear handoff
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {ok ? <p className="mt-3 text-sm text-emerald-800">{ok}</p> : null}
    </section>
  );
}
