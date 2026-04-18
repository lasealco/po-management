/**
 * Narrative panel summarizing how invoice lines were matched to the pricing snapshot.
 * Detailed per-line outcomes live in `InvoiceLinesMatchTable`.
 */
export function InvoiceMatchResultPanel(props: {
  snapshotSummary: string | null;
  snapshotId: string;
  lineCount: number;
  auditResultCount: number;
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
        . Text similarity picks a snapshot charge or rate line; amounts are compared using active tolerance rules (or
        built-in defaults if none apply).
      </p>
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
