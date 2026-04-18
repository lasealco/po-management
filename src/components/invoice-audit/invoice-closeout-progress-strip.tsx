import type { ReactNode } from "react";
import Link from "next/link";

function stepShell(done: boolean, children: ReactNode) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 text-sm ${
        done
          ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
          : "border-zinc-200 bg-zinc-50 text-zinc-700"
      }`}
    >
      {children}
    </div>
  );
}

export function InvoiceCloseoutProgressStrip(props: {
  /** Intake reached AUDITED (line outcomes exist); closeout is meaningful. */
  auditComplete: boolean;
  hasOpsNotes: boolean;
  reviewDecision: string;
  approvedForAccounting: boolean;
}) {
  if (!props.auditComplete) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Closeout</p>
        <p className="mt-2 text-sm text-zinc-600">
          After <span className="font-medium text-zinc-800">Run audit</span> completes successfully, this page will
          show where you are in ops notes → finance review → accounting handoff.
        </p>
      </section>
    );
  }

  const financeDone = props.reviewDecision === "APPROVED" || props.reviewDecision === "OVERRIDDEN";
  const financeLabel =
    props.reviewDecision === "APPROVED"
      ? "Approve"
      : props.reviewDecision === "OVERRIDDEN"
        ? "Override"
        : null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm" aria-label="Closeout progress">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Closeout · where you are</p>
        <Link
          href="#invoice-audit-closeout-guide"
          className="text-xs font-medium text-[var(--arscmp-primary)] hover:underline"
        >
          Step definitions
        </Link>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {stepShell(props.hasOpsNotes, (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 1 · Ops</p>
            <p className="mt-1 font-medium text-zinc-900">{props.hasOpsNotes ? "Notes saved" : "Optional"}</p>
            <a href="#invoice-audit-ops-notes" className="mt-2 inline-block text-xs font-medium text-[var(--arscmp-primary)] hover:underline">
              {props.hasOpsNotes ? "Edit ops notes" : "Add ops notes"}
            </a>
          </div>
        ))}
        {stepShell(financeDone, (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 2 · Finance</p>
            <p className="mt-1 font-medium text-zinc-900">
              {financeDone ? (financeLabel === "Override" ? "Override recorded" : "Approve recorded") : "Awaiting decision"}
            </p>
            <a
              href="#invoice-audit-finance-review"
              className="mt-2 inline-block text-xs font-medium text-[var(--arscmp-primary)] hover:underline"
            >
              {financeDone ? "View or change review" : "Record Approve or Override"}
            </a>
          </div>
        ))}
        {stepShell(props.approvedForAccounting, (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Step 3 · Accounting</p>
            <p className="mt-1 font-medium text-zinc-900">
              {props.approvedForAccounting ? "Handoff marked" : financeDone ? "Ready when you are" : "Needs Step 2 first"}
            </p>
            <a
              href="#invoice-audit-accounting-handoff"
              className="mt-2 inline-block text-xs font-medium text-[var(--arscmp-primary)] hover:underline"
            >
              {props.approvedForAccounting ? "View handoff" : "Open handoff"}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
