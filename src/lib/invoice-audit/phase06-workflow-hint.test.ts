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
