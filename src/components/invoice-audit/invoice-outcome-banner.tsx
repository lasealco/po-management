import type { InvoiceAuditRollupOutcome, InvoiceIntakeStatus } from "@prisma/client";

export function InvoiceOutcomeBanner(props: {
  status: InvoiceIntakeStatus;
  rollupOutcome: InvoiceAuditRollupOutcome;
  parseError: string | null;
  auditRunError: string | null;
  greenLineCount: number;
  amberLineCount: number;
  redLineCount: number;
  unknownLineCount: number;
  /** When true, nudges ops to use Step 1 notes + closeout workflow (no schema change). */
  suggestCloseoutDocumentation?: boolean;
}) {
  if (props.parseError) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-red-950 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Parse error</p>
        <p className="mt-2 text-sm">{props.parseError}</p>
      </div>
    );
  }

  if (props.status === "FAILED" && props.auditRunError) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-red-950 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Audit run failed</p>
        <p className="mt-2 text-sm font-medium">The audit engine did not complete. Details are shown so nothing fails silently.</p>
        <p className="mt-2 text-sm">{props.auditRunError}</p>
      </div>
    );
  }

  if (props.status !== "AUDITED" && props.rollupOutcome === "NONE") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-100 px-5 py-4 text-zinc-800 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Outcome</p>
        <p className="mt-2 text-sm">Audit not run yet. Add lines (already saved) and run match against the linked pricing snapshot.</p>
      </div>
    );
  }

  const tone =
    props.rollupOutcome === "PASS"
      ? {
          border: "border-emerald-300",
          bg: "bg-emerald-50",
          text: "text-emerald-950",
          label: "Pass",
          hint: "All matched lines are within tolerance vs the pricing snapshot.",
        }
      : props.rollupOutcome === "WARN"
        ? {
            border: "border-amber-300",
            bg: "bg-amber-50",
            text: "text-amber-950",
            label: "Review",
            hint: "At least one line is ambiguous, unknown match, or in the warn band.",
          }
        : props.rollupOutcome === "FAIL"
          ? {
              border: "border-red-300",
              bg: "bg-red-50",
              text: "text-red-950",
              label: "Fail",
              hint: "At least one line has a material amount variance vs the snapshot match.",
            }
          : {
              border: "border-zinc-200",
              bg: "bg-zinc-50",
              text: "text-zinc-800",
              label: props.rollupOutcome === "PENDING" ? "Pending" : String(props.rollupOutcome),
              hint:
                props.rollupOutcome === "PENDING"
                  ? "Run audit to compare each parsed line against the linked pricing snapshot."
                  : "",
            };

  return (
    <div className={`rounded-2xl border px-5 py-4 shadow-sm ${tone.border} ${tone.bg} ${tone.text}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Rollup outcome</p>
          <p className="mt-1 text-xl font-semibold">{tone.label}</p>
          {tone.hint ? <p className="mt-2 max-w-2xl text-sm opacity-90">{tone.hint}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-emerald-600/15 px-3 py-1 text-emerald-900">Green {props.greenLineCount}</span>
          <span className="rounded-full bg-amber-500/20 px-3 py-1 text-amber-950">Amber {props.amberLineCount}</span>
          <span className="rounded-full bg-red-600/15 px-3 py-1 text-red-900">Red {props.redLineCount}</span>
          <span className="rounded-full bg-zinc-500/15 px-3 py-1 text-zinc-800">Unknown {props.unknownLineCount}</span>
        </div>
      </div>
      {props.status === "AUDITED" && props.suggestCloseoutDocumentation ? (
        <p className="mt-3 border-t border-black/5 pt-3 text-xs leading-relaxed opacity-90">
          <span className="font-semibold text-current">Closeout tip:</span> capture carrier or dispute context under{" "}
          <span className="font-medium">Step 1 — Ops &amp; escalation notes</span> on this page, then complete{" "}
          <span className="font-medium">Step 2 — Finance review</span> before{" "}
          <span className="font-medium">Step 3 — Accounting handoff</span>.
        </p>
      ) : null}
    </div>
  );
}
