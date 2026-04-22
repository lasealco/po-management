import { describe, expect, it } from "vitest";

import { ctTrackingMilestoneProvenancePill, workflowMilestoneSourcePill } from "./milestone-provenance";

describe("ctTrackingMilestoneProvenancePill", () => {
  it("maps known integration and simulated types", () => {
    expect(ctTrackingMilestoneProvenancePill("integration").label).toBe("Integration");
    expect(ctTrackingMilestoneProvenancePill("SIMULATED").label).toBe("Simulated");
  });

  it("defaults empty and manual to Manual pill", () => {
    expect(ctTrackingMilestoneProvenancePill("").label).toBe("Manual");
    expect(ctTrackingMilestoneProvenancePill("  manual  ").label).toBe("Manual");
  });

  it("truncates long unknown types for label", () => {
    const long = "VERY_LONG_CUSTOM_TYPE_XX";
    const r = ctTrackingMilestoneProvenancePill(long);
    expect(r.label.length).toBeLessThanOrEqual(15);
    expect(r.label.endsWith("…")).toBe(true);
  });
});

describe("workflowMilestoneSourcePill", () => {
  it("maps enum-like sources", () => {
    expect(workflowMilestoneSourcePill("internal").label).toBe("Internal");
    expect(workflowMilestoneSourcePill("SUPPLIER").label).toBe("Supplier");
    expect(workflowMilestoneSourcePill("FORWARDER").label).toBe("Forwarder");
    expect(workflowMilestoneSourcePill("system").label).toBe("System");
  });

  it("falls back for unknown source", () => {
    const r = workflowMilestoneSourcePill("custom");
    expect(r.label).toBe("CUSTOM");
    expect(r.title).toContain("custom");
  });
});
