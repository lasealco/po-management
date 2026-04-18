import type { InvoiceAuditLineOutcome } from "@prisma/client";

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

/** One-line summary of snapshot match JSON for demos (not full JSON). */
function matchedTargetLabel(json: unknown): string {
  if (!json || typeof json !== "object" || Array.isArray(json)) return "—";
  const j = json as Record<string, unknown>;
  if (typeof j.mode === "string") {
    const exp = j.expectedAmount;
    if (j.mode === "CONTRACT_BREAKDOWN_GRAND" && (typeof exp === "number" || typeof exp === "string")) {
      return `All-in vs contract grand (${String(exp)})`;
    }
    if (j.mode === "CONTRACT_BASKET_SUM" && Array.isArray(j.components)) {
      return `All-in basket (${j.components.length} parts)`;
    }
    if (j.mode === "RFQ_ALL_IN_TOTAL") {
      return typeof exp === "number" || typeof exp === "string" ? `All-in vs RFQ total (${String(exp)})` : "All-in vs RFQ total";
    }
  }
  if (typeof j.label === "string" && j.label.trim()) {
    const k = typeof j.kind === "string" ? `${j.kind}: ` : "";
    return `${k}${j.label}`.slice(0, 96);
  }
  if (Array.isArray(j.ambiguousCandidates) && j.ambiguousCandidates.length > 0) {
    return `Ambiguous (${j.ambiguousCandidates.length} tied)`;
  }
  if (Array.isArray(j.topScores) && j.topScores.length > 0) {
    return "Low confidence (see JSON)";
  }
  return "—";
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
                  {ar ? matchedTargetLabel(ar.snapshotMatchedJson) : "—"}
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
