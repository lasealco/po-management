export type RfqCompareRow = {
  recipient: string;
  status: string;
  total: string;
  currency: string;
  validity: string;
  includedSummary: string;
  excludedSummary: string;
  freeTimeSummary: string;
};

export function RfqCompareTable({ rows }: { rows: RfqCompareRow[] }) {
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
            <th className="py-3 pl-4 pr-3">Recipient</th>
            <th className="py-3 pr-3">Status</th>
            <th className="py-3 pr-3">Total</th>
            <th className="py-3 pr-3">Validity</th>
            <th className="py-3 pr-3">Included</th>
            <th className="py-3 pr-3">Excluded</th>
            <th className="py-3 pr-4">Free time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-zinc-100 align-top">
              <td className="py-3 pl-4 pr-3 font-medium text-zinc-900">{r.recipient}</td>
              <td className="py-3 pr-3 text-xs text-zinc-600">{r.status}</td>
              <td className="py-3 pr-3 font-mono text-xs">
                {r.total} {r.currency}
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
