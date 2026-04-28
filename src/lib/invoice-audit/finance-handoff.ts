export const INVOICE_FINANCE_HANDOFF_STATUSES = ["DRAFT", "READY_FOR_FINANCE", "DISPUTE_QUEUED", "ACCOUNTING_READY"] as const;

export type InvoiceFinanceHandoffStatus = (typeof INVOICE_FINANCE_HANDOFF_STATUSES)[number];

export type InvoiceFinanceHandoffLine = {
  lineNo: number | null;
  description: string;
  currency: string;
  amount: string;
  outcome: string;
  expectedAmount: string | null;
  amountVariance: string | null;
  explanation: string;
};

export function parseInvoiceFinanceHandoffStatus(value: unknown): InvoiceFinanceHandoffStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return INVOICE_FINANCE_HANDOFF_STATUSES.includes(normalized as InvoiceFinanceHandoffStatus)
    ? (normalized as InvoiceFinanceHandoffStatus)
    : null;
}

export function buildFinanceHandoffSummary(params: {
  vendorLabel: string | null;
  externalInvoiceNo: string | null;
  rollupOutcome: string;
  currency: string;
  snapshotTotal: string;
  snapshotSourceSummary: string | null;
  lines: InvoiceFinanceHandoffLine[];
}) {
  const attention = params.lines.filter((line) => line.outcome === "AMBER" || line.outcome === "RED" || line.outcome === "UNKNOWN");
  const varianceTotal = params.lines.reduce((sum, line) => {
    const n = line.amountVariance == null ? 0 : Number(line.amountVariance);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);
  return [
    `Invoice ${params.externalInvoiceNo ?? "(no invoice #)"} from ${params.vendorLabel ?? "vendor"} audited as ${params.rollupOutcome}.`,
    `Frozen pricing snapshot total: ${params.snapshotTotal} ${params.currency}${params.snapshotSourceSummary ? ` (${params.snapshotSourceSummary})` : ""}.`,
    `${attention.length} attention line${attention.length === 1 ? "" : "s"} require finance review.`,
    `Net stored variance across matched lines: ${varianceTotal.toFixed(2)} ${params.currency}.`,
  ].join("\n");
}

export function buildDisputeDraft(params: {
  vendorLabel: string | null;
  externalInvoiceNo: string | null;
  lines: InvoiceFinanceHandoffLine[];
}) {
  const attention = params.lines.filter((line) => line.outcome === "AMBER" || line.outcome === "RED").slice(0, 8);
  const lineText =
    attention.length > 0
      ? attention
          .map(
            (line) =>
              `- Line ${line.lineNo ?? "?"}: ${line.description} invoice ${line.amount} ${line.currency}; expected ${line.expectedAmount ?? "n/a"}; variance ${line.amountVariance ?? "n/a"}. ${line.explanation}`,
          )
          .join("\n")
      : "- No AMBER/RED variance lines are currently present; confirm invoice can be processed or add finance note.";
  return [
    `Subject: Invoice audit variance ${params.externalInvoiceNo ?? ""}`,
    "",
    `Hi ${params.vendorLabel ?? "team"},`,
    "",
    "We reviewed the invoice against our frozen pricing snapshot and need clarification on the following charges:",
    lineText,
    "",
    "Please confirm whether these charges should be corrected, credited, or supported with contract/RFQ evidence.",
  ].join("\n");
}

export function buildAccountingPacket(params: {
  intakeId: string;
  snapshotId: string;
  rollupOutcome: string;
  reviewDecision: string;
  approvedForAccounting: boolean;
  summary: string;
  lines: InvoiceFinanceHandoffLine[];
}) {
  return {
    intakeId: params.intakeId,
    pricingSnapshotId: params.snapshotId,
    rollupOutcome: params.rollupOutcome,
    reviewDecision: params.reviewDecision,
    approvedForAccounting: params.approvedForAccounting,
    summary: params.summary,
    attentionLines: params.lines.filter((line) => line.outcome !== "GREEN"),
    generatedAt: new Date().toISOString(),
  };
}
