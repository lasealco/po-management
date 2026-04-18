import Link from "next/link";

/**
 * Narrative panel summarizing how invoice lines were matched to the pricing snapshot.
 * Detailed per-line outcomes live in `InvoiceLinesMatchTable`.
 */
export function InvoiceMatchResultPanel(props: {
  snapshotSummary: string | null;
  snapshotId: string;
  /** Human label for `BookingPricingSnapshot.sourceType` (tariff vs RFQ). */
  basisLabel: string;
  sourceRecordId: string;
  /** Deep links when rows still exist (same resolver as Linked snapshot). */
  tariffVersionHref?: string | null;
  rfqRequestHref?: string | null;
  shipmentWorkspaceHref?: string | null;
  lineCount: number;
  auditResultCount: number;
  polCode?: string | null;
  podCode?: string | null;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Match result</h2>
      <p className="mt-2 rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-sm text-sky-950">
        <span className="font-semibold text-sky-950">Commercial basis</span> — rates were frozen from{" "}
        <span className="font-medium">{props.basisLabel}</span>
        {props.sourceRecordId ? (
          <>
            {" "}
            (source record <span className="font-mono text-xs">{props.sourceRecordId}</span>)
          </>
        ) : null}
        . Invoice audit compares each parsed line to the{" "}
        <span className="font-medium">same snapshot payload</span> shown on the pricing snapshot page — not live
        contract or RFQ edits after <span className="font-mono text-xs">{props.snapshotId}</span> was created.
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        Lines are matched to the frozen pricing snapshot <span className="font-mono text-xs">{props.snapshotId}</span>
        {props.snapshotSummary ? (
          <>
            {" "}
            — <span className="font-medium text-zinc-800">{props.snapshotSummary}</span>
          </>
        ) : null}
        . Ocean scoring uses equipment, optional POL/POD, unit basis, tenant charge aliases, built-in wording expansion
        (for example THC, AMS, demurrage, customs, ETS), and all-in vs itemized logic; amounts use active tolerance
        rules (or built-in defaults if none apply). Per-line outcomes use the{" "}
        <span className="font-medium text-zinc-800">Snapshot match</span> column for a short label; expand stored JSON
        below the table on the intake detail page when you need the full payload. The{" "}
        <span className="font-medium text-zinc-800">Audit run</span> panel (further down) shows the tolerance band that
        was applied for the latest audit.
      </p>
      {props.polCode || props.podCode ? (
        <p className="mt-2 font-mono text-xs text-zinc-600">
          Intake route: POL {props.polCode ?? "—"} → POD {props.podCode ?? "—"}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        <Link
          href={`/pricing-snapshots/${encodeURIComponent(props.snapshotId)}`}
          className="inline-flex items-center rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95"
        >
          Open pricing snapshot
        </Link>
        {props.tariffVersionHref ? (
          <Link
            href={props.tariffVersionHref}
            className="inline-flex items-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
          >
            Open tariff contract version
          </Link>
        ) : null}
        {props.rfqRequestHref ? (
          <Link
            href={props.rfqRequestHref}
            className="inline-flex items-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
          >
            Open RFQ request
          </Link>
        ) : null}
        {props.shipmentWorkspaceHref ? (
          <Link
            href={props.shipmentWorkspaceHref}
            className="inline-flex items-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
          >
            Open Control Tower shipment
          </Link>
        ) : null}
        <p className="w-full text-xs text-zinc-500">
          The snapshot page shows the full frozen breakdown JSON; this intake reuses that immutable economics for every
          audit run.
        </p>
      </div>
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
