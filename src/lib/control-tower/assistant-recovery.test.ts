import { describe, expect, it } from "vitest";

import {
  buildCarrierDraft,
  buildCustomerDraft,
  buildRecoveryPlan,
  defaultRecoveryPlaybook,
  parseCtRecoveryState,
} from "./assistant-recovery";

const shipment = {
  shipmentNo: "SHP-1",
  trackingNo: "TRK",
  carrier: "Carrier",
  customerName: "ABC",
  originCode: "FRA",
  destinationCode: "CHI",
  latestEta: "2026-05-01T00:00:00.000Z",
  orderNumber: "PO-1",
};

const exception = {
  id: "e1",
  type: "LATE",
  typeLabel: "Late shipment",
  severity: "CRITICAL",
  status: "OPEN",
  rootCause: "Carrier rolled booking",
  ownerName: "Ops",
  customerImpact: "Delivery may slip two days.",
};

describe("parseCtRecoveryState", () => {
  it("normalizes valid states", () => {
    expect(parseCtRecoveryState("customer_updated")).toBe("CUSTOMER_UPDATED");
  });

  it("rejects invalid states", () => {
    expect(parseCtRecoveryState("DONE")).toBeNull();
  });
});

describe("Control Tower recovery drafts", () => {
  it("builds recovery plan and communication drafts", () => {
    expect(buildRecoveryPlan({ shipment, exceptions: [exception] })).toContain("Carrier rolled booking");
    expect(buildCarrierDraft({ shipment, exception })).toContain("revised ETA");
    expect(buildCustomerDraft({ shipment, exception })).toContain("Delivery may slip two days");
  });

  it("returns the default recovery playbook steps", () => {
    expect(defaultRecoveryPlaybook()).toHaveLength(4);
  });
});
