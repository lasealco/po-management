import type { InvoiceAuditLineOutcome } from "@prisma/client";

import { formatSnapshotMatchLabel } from "@/lib/invoice-audit/snapshot-match-label";

function outcomeDot(outcome: InvoiceAuditLineOutcome) {
  if (outcome === "GREEN") return "bg-emerald-500";
  if (outcome === "AMBER") return "bg-amber-500";
  if (outcome === "RED") return "bg-red-500";
  return "bg-zinc-400";
}

function outcomeLabel(outcome: InvoiceAuditLineOutcome) {
  return outcome;
}

function fmtCat(raw: unknown): string {
  if (!Array.isArray(raw)) return "";
  return raw.map((x) => String(x)).join(", ");
}

export type LineRow = {
  id: string;
  lineNo: number;
  rawDescription: string;
  currency: string;
  amount: string;
  unitBasis?: string | null;
  equipmentType?: string | null;
  chargeStructureHint?: string | null;
};

export type AuditRow = {
  invoiceLineId: string;
  outcome: InvoiceAuditLineOutcome;
  discrepancyCategories: unknown;
  expectedAmount: string | null;
  amountVariance: string | null;
  explanation: string;
  snapshotMatchedJson: unknown;
};

export function InvoiceLinesMatchTable(props: { lines: LineRow[]; auditResults: AuditRow[] }) {
  const byLine = new Map(props.auditResults.map((a) => [a.invoiceLineId, a]));

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Invoice description</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Match</th>
            <th className="px-4 py-3">Snapshot match</th>
            <th className="px-4 py-3">Categories</th>
            <th className="px-4 py-3">Expected</th>
            <th className="px-4 py-3">Variance</th>
            <th className="px-4 py-3">Explanation</th>
          </tr>
        </thead>
        <tbody>
          {props.lines.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-10 text-center text-sm text-zinc-500">
                No parsed lines on this intake. If you expected rows here, re-create the intake or add lines from the
                intake workflow that feeds this table.
              </td>
            </tr>
          ) : null}
          {props.lines.map((ln) => {
            const ar = byLine.get(ln.id);
            return (
              <tr key={ln.id} className="border-b border-zinc-100 align-top">
                <td className="px-4 py-3 tabular-nums text-zinc-700">{ln.lineNo}</td>
                <td className="px-4 py-3 text-zinc-900">
                  <div>{ln.rawDescription}</div>
                  {ln.equipmentType || ln.unitBasis || ln.chargeStructureHint ? (
                    <div className="mt-1 font-mono text-xs text-zinc-500">
                      {[ln.equipmentType, ln.unitBasis, ln.chargeStructureHint].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {ln.amount} {ln.currency}
                </td>
                <td className="px-4 py-3">
                  {ar ? (
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <span className={`h-2.5 w-2.5 rounded-full ${outcomeDot(ar.outcome)}`} aria-hidden />
                      {outcomeLabel(ar.outcome)}
                    </span>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="max-w-[12rem] px-4 py-3 text-xs text-zinc-700">
                  {ar ? formatSnapshotMatchLabel(ar.snapshotMatchedJson) : "—"}
                </td>
                <td className="max-w-[10rem] px-4 py-3 font-mono text-xs text-zinc-700">
                  {ar ? fmtCat(ar.discrepancyCategories) : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-zinc-800">{ar?.expectedAmount ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums text-zinc-800">{ar?.amountVariance ?? "—"}</td>
                <td className="max-w-md px-4 py-3 text-zinc-600">{ar?.explanation ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
