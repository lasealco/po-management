import { describe, expect, it } from "vitest";

import {
  buildOrderOrchestrationProposal,
  buildOrderOrchestrationSummary,
  computeLinePromise,
  parseOrderDemandText,
} from "./order-orchestration";

describe("order orchestration helpers", () => {
  it("extracts a demand quantity from free text", () => {
    const demand = parseOrderDemandText("Customer asks for qty 24 of blue cartons next week");
    expect(demand.lines[0]?.quantity).toBe(24);
    expect(demand.title).toContain("Customer asks");
  });

  it("marks a line ready when available now covers demand", () => {
    const line = computeLinePromise({ description: "SKU", quantity: 10, availableNow: 12, inboundQty: 0, shortageQty: 0 });
    expect(line.promiseStatus).toBe("PROMISE_READY");
    expect(line.laterQty).toBe(0);
  });

  it("requires split and human approval when ATP is short", () => {
    const proposal = buildOrderOrchestrationProposal([
      { description: "SKU", quantity: 20, availableNow: 8, inboundQty: 4, shortageQty: 12 },
    ]);
    expect(proposal.status).toBe("NEEDS_APPROVAL");
    expect(proposal.splitRequired).toBe(true);
    expect(proposal.reservationPolicy).toContain("Human approval required");
  });

  it("summarizes no-silent-mutation control", () => {
    const proposal = buildOrderOrchestrationProposal([
      { description: "SKU", quantity: 1, availableNow: 1, inboundQty: 0, shortageQty: 0 },
    ]);
    const summary = buildOrderOrchestrationSummary({ customerName: "Acme", lineCount: 1, proposal });
    expect(summary).toContain("Order orchestration plan for Acme");
    expect(summary).toContain("Human approval required");
  });
});
