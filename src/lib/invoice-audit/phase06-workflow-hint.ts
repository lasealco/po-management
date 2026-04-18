/**
 * Single prioritized “what to do next” for Phase 06 invoice audit (list + deep links).
 * No I/O — safe for server components and unit tests.
 */
export type Phase06WorkflowHint = {
  label: string;
  /** Append to `/invoice-audit/{id}`; empty when the detail landing view is enough. */
  hash: string;
};

export function getPhase06WorkflowHint(row: {
  status: string;
  rollupOutcome: string;
  reviewDecision: string;
  approvedForAccounting: boolean;
  parseError?: string | null;
  auditRunError?: string | null;
  unknownLineCount: number;
  redLineCount: number;
}): Phase06WorkflowHint | null {
  if (row.parseError?.trim()) {
    return { label: "Fix parse on detail", hash: "" };
  }
  if (row.status === "FAILED" && row.auditRunError?.trim()) {
    return { label: "Fix audit on detail", hash: "" };
  }

  if (row.status !== "AUDITED") {
    if (row.status === "PARSED") {
      return { label: "Run audit", hash: "" };
    }
    if (row.status === "DRAFT" || row.status === "RECEIVED") {
      return { label: "Open intake", hash: "" };
    }
    return null;
  }

  if (row.reviewDecision === "NONE" && row.unknownLineCount > 0) {
    return {
      label: `Triage ${row.unknownLineCount} UNKNOWN line${row.unknownLineCount === 1 ? "" : "s"}`,
      hash: "#invoice-audit-lines-match",
    };
  }

  if (row.reviewDecision === "NONE") {
    return { label: "Step 2 · Finance review", hash: "#invoice-audit-finance-review" };
  }
  if (!row.approvedForAccounting) {
    return { label: "Step 3 · Accounting handoff", hash: "#invoice-audit-accounting-handoff" };
  }

  const needsAuditTrail =
    row.rollupOutcome === "FAIL" ||
    row.rollupOutcome === "WARN" ||
    row.unknownLineCount > 0 ||
    row.redLineCount > 0;
  if (needsAuditTrail) {
    if (row.unknownLineCount > 0 && row.redLineCount === 0 && row.rollupOutcome !== "FAIL" && row.rollupOutcome !== "WARN") {
      return {
        label: `Re-check ${row.unknownLineCount} UNKNOWN line${row.unknownLineCount === 1 ? "" : "s"} (ops)`,
        hash: "#invoice-audit-lines-match",
      };
    }
    return { label: "Step 1 · Ops notes (recommended)", hash: "#invoice-audit-ops-notes" };
  }

  return null;
}
