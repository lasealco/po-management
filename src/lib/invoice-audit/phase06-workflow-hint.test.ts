import { describe, expect, it } from "vitest";

import { getPhase06WorkflowHint } from "@/lib/invoice-audit/phase06-workflow-hint";

describe("getPhase06WorkflowHint", () => {
  it("prioritizes finance review after audit when no decision yet", () => {
    const h = getPhase06WorkflowHint({
      status: "AUDITED",
      rollupOutcome: "WARN",
      reviewDecision: "NONE",
      approvedForAccounting: false,
      unknownLineCount: 0,
      redLineCount: 0,
    });
    expect(h).toEqual({
      label: "Step 2 · Finance review",
      hash: "#invoice-audit-finance-review",
    });
  });

  it("prioritizes UNKNOWN triage before finance when counts show unmatched lines", () => {
    const h = getPhase06WorkflowHint({
      status: "AUDITED",
      rollupOutcome: "PASS",
      reviewDecision: "NONE",
      approvedForAccounting: false,
      unknownLineCount: 2,
      redLineCount: 0,
    });
    expect(h).toEqual({
      label: "Triage 2 UNKNOWN lines",
      hash: "#invoice-audit-lines-match",
    });
  });

  it("uses singular copy for a single UNKNOWN line", () => {
    expect(
      getPhase06WorkflowHint({
        status: "AUDITED",
        rollupOutcome: "PASS",
        reviewDecision: "NONE",
        approvedForAccounting: false,
        unknownLineCount: 1,
        redLineCount: 0,
      }),
    ).toEqual({ label: "Triage 1 UNKNOWN line", hash: "#invoice-audit-lines-match" });
  });

  it("sends to accounting handoff after finance signed off", () => {
    const h = getPhase06WorkflowHint({
      status: "AUDITED",
      rollupOutcome: "PASS",
      reviewDecision: "APPROVED",
      approvedForAccounting: false,
      unknownLineCount: 0,
      redLineCount: 0,
    });
    expect(h).toEqual({
      label: "Step 3 · Accounting handoff",
      hash: "#invoice-audit-accounting-handoff",
    });
  });

  it("treats Override like Approve for Step 3 routing", () => {
    const h = getPhase06WorkflowHint({
      status: "AUDITED",
      rollupOutcome: "FAIL",
      reviewDecision: "OVERRIDDEN",
      approvedForAccounting: false,
      unknownLineCount: 0,
      redLineCount: 1,
    });
    expect(h).toEqual({
      label: "Step 3 · Accounting handoff",
      hash: "#invoice-audit-accounting-handoff",
    });
  });

  it("nudges ops notes only after handoff when rollup still risky", () => {
    const h = getPhase06WorkflowHint({
      status: "AUDITED",
      rollupOutcome: "WARN",
      reviewDecision: "APPROVED",
      approvedForAccounting: true,
      unknownLineCount: 0,
      redLineCount: 0,
    });
    expect(h).toEqual({
      label: "Step 1 · Ops notes (recommended)",
      hash: "#invoice-audit-ops-notes",
    });
  });

  it("after handoff, UNKNOWN-only rollup points to the lines table", () => {
    const h = getPhase06WorkflowHint({
      status: "AUDITED",
      rollupOutcome: "PASS",
      reviewDecision: "APPROVED",
      approvedForAccounting: true,
      unknownLineCount: 3,
      redLineCount: 0,
    });
    expect(h).toEqual({
      label: "Re-check 3 UNKNOWN lines (ops)",
      hash: "#invoice-audit-lines-match",
    });
  });

  it("after handoff, UNKNOWN with WARN still prefers ops notes", () => {
    const h = getPhase06WorkflowHint({
      status: "AUDITED",
      rollupOutcome: "WARN",
      reviewDecision: "APPROVED",
      approvedForAccounting: true,
      unknownLineCount: 2,
      redLineCount: 0,
    });
    expect(h).toEqual({
      label: "Step 1 · Ops notes (recommended)",
      hash: "#invoice-audit-ops-notes",
    });
  });

  it("returns null when closeout is complete and rollup is clean", () => {
    expect(
      getPhase06WorkflowHint({
        status: "AUDITED",
        rollupOutcome: "PASS",
        reviewDecision: "APPROVED",
        approvedForAccounting: true,
        unknownLineCount: 0,
        redLineCount: 0,
      }),
    ).toBeNull();
  });

  it("surfaces PARSED as run-audit", () => {
    expect(getPhase06WorkflowHint(base({ status: "PARSED", rollupOutcome: "PENDING" }))).toEqual({
      label: "Run audit",
      hash: "",
    });
  });

  it("surfaces FAILED with audit error", () => {
    expect(
      getPhase06WorkflowHint(
        base({
          status: "FAILED",
          rollupOutcome: "NONE",
          auditRunError: "boom",
        }),
      ),
    ).toEqual({ label: "Fix audit on detail", hash: "" });
  });

  it("surfaces parse errors first", () => {
    expect(
      getPhase06WorkflowHint(
        base({
          status: "RECEIVED",
          parseError: "bad csv",
        }),
      ),
    ).toEqual({ label: "Fix parse on detail", hash: "" });
  });
});

function base(
  overrides: Partial<Parameters<typeof getPhase06WorkflowHint>[0]> = {},
): Parameters<typeof getPhase06WorkflowHint>[0] {
  return {
    status: "AUDITED",
    rollupOutcome: "PASS",
    reviewDecision: "NONE",
    approvedForAccounting: false,
    unknownLineCount: 0,
    redLineCount: 0,
    ...overrides,
  };
}
