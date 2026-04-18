import Link from "next/link";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";
import type { RfqCompareRow } from "@/lib/rfq/build-compare-rows";

export type { RfqCompareRow };

function peerBenchmarkClass(tone: RfqCompareRow["peerBenchmarkTone"]): string {
  if (tone === "lowest") return "font-semibold text-emerald-800";
  if (tone === "delta") return "tabular-nums text-amber-900";
  return "text-zinc-500";
}

export function RfqCompareTable(props: { rows: RfqCompareRow[]; quoteRequestId?: string }) {
  const { rows, quoteRequestId } = props;
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
        No submitted quotes to compare yet. Enter quotes and submit them from each recipient row.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            <th
              className="py-3 pl-4 pr-3"
              title={
                quoteRequestId ? "Recipient names link to the saved quote response for traceability." : undefined
              }
            >
              Recipient
            </th>
            <th className="py-3 pr-3">Recipient id</th>
            <th className="py-3 pr-3">Response id</th>
            <th className="py-3 pr-3">Status</th>
            <th className="py-3 pr-3">Total</th>
            <th
              className="py-3 pr-3"
              title="When two or more quotes share a currency and include an all-in total, this column flags the lowest and shows everyone else’s gap vs that benchmark."
            >
              Vs peer low
            </th>
            <th className="py-3 pr-3">Validity</th>
            <th className="py-3 pr-3">Included</th>
            <th className="py-3 pr-3">Excluded</th>
            <th className="py-3 pr-4">Free time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.responseId} className="border-b border-zinc-100 align-top">
              <td className="py-3 pl-4 pr-3 font-medium text-zinc-900">
                {quoteRequestId ? (
                  <Link
                    href={`/rfq/requests/${quoteRequestId}/responses/${r.responseId}/edit`}
                    className="text-[var(--arscmp-primary)] hover:underline"
                    title="Open quote response for this row"
                  >
                    {r.recipient}
                  </Link>
                ) : (
                  r.recipient
                )}
              </td>
              <td className="py-3 pr-3 align-top">
                <RecordIdCopy id={r.recipientId} copyButtonLabel="Copy recipient id" />
              </td>
              <td className="py-3 pr-3 align-top">
                <RecordIdCopy id={r.responseId} copyButtonLabel="Copy response id" />
              </td>
              <td className="py-3 pr-3 text-xs text-zinc-600">{r.status}</td>
              <td className="py-3 pr-3 font-mono text-xs">
                {r.total} {r.currency}
              </td>
              <td className="max-w-[10rem] py-3 pr-3 text-xs">
                {r.peerBenchmarkLabel ? (
                  <span className={peerBenchmarkClass(r.peerBenchmarkTone)} title={r.peerBenchmarkTitle ?? undefined}>
                    {r.peerBenchmarkLabel}
                  </span>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
              <td className="py-3 pr-3 text-xs text-zinc-700">{r.validity}</td>
              <td className="max-w-[14rem] py-3 pr-3 text-xs text-zinc-600">{r.includedSummary}</td>
              <td className="max-w-[14rem] py-3 pr-3 text-xs text-zinc-600">{r.excludedSummary}</td>
              <td className="max-w-[16rem] py-3 pr-4 text-xs text-zinc-600">{r.freeTimeSummary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
