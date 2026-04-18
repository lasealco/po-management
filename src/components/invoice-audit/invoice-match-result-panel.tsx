/**
 * Narrative panel summarizing how invoice lines were matched to the pricing snapshot.
 * Detailed per-line outcomes live in `InvoiceLinesMatchTable`.
 */
export function InvoiceMatchResultPanel(props: {
  snapshotSummary: string | null;
  snapshotId: string;
  lineCount: number;
  auditResultCount: number;
  polCode?: string | null;
  podCode?: string | null;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Match result</h2>
      <p className="mt-2 text-sm text-zinc-600">
        Lines are matched to the frozen pricing snapshot <span className="font-mono text-xs">{props.snapshotId}</span>
        {props.snapshotSummary ? (
          <>
            {" "}
            — <span className="font-medium text-zinc-800">{props.snapshotSummary}</span>
          </>
        ) : null}
        . Ocean scoring uses equipment, optional POL/POD, unit basis, tenant charge aliases, and all-in vs itemized
        logic; amounts use active tolerance rules (or built-in defaults if none apply).
      </p>
      {props.polCode || props.podCode ? (
        <p className="mt-2 font-mono text-xs text-zinc-600">
          Intake route: POL {props.polCode ?? "—"} → POD {props.podCode ?? "—"}
        </p>
      ) : null}
      <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 text-xs text-zinc-700">
        <p className="font-semibold text-zinc-800">Line outcomes (demo legend)</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <span className="font-medium text-emerald-800">GREEN</span> — matched snapshot line and within primary
            tolerance.
          </li>
          <li>
            <span className="font-medium text-amber-800">AMBER</span> — matched with soft commercial flags, warn-band
            amount, ambiguous tie, or all-in basket in warn band.
          </li>
          <li>
            <span className="font-medium text-red-800">RED</span> — matched but amount outside warn band vs snapshot.
          </li>
          <li>
            <span className="font-medium text-zinc-600">UNKNOWN</span> — no confident snapshot line (currency, empty
            pool, or low match score).
          </li>
        </ul>
      </div>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Parsed lines</dt>
          <dd className="font-semibold text-zinc-900">{props.lineCount}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Audit rows</dt>
          <dd className="font-semibold text-zinc-900">{props.auditResultCount}</dd>
        </div>
      </dl>
    </section>
  );
}
