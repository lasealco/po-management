import { describe, expect, it } from "vitest";

import {
  buildTwinRiskPlaybookSummary,
  buildTwinScenarioDraftFromPrompt,
  computeTwinGraphConfidence,
} from "./assistant";

describe("supply chain twin assistant helpers", () => {
  it("scores stronger graphs higher than sparse graphs", () => {
    const sparse = computeTwinGraphConfidence({
      entityCount: 10,
      edgeCount: 1,
      entityKinds: [{ entityKind: "order", count: 10 }],
      openRiskCount: 3,
      scenarioCount: 0,
    });
    const strong = computeTwinGraphConfidence({
      entityCount: 20,
      edgeCount: 25,
      entityKinds: [
        { entityKind: "order", count: 5 },
        { entityKind: "shipment", count: 5 },
        { entityKind: "supplier", count: 5 },
        { entityKind: "inventory", count: 5 },
        { entityKind: "finance", count: 3 },
        { entityKind: "warehouse", count: 2 },
      ],
      openRiskCount: 0,
      scenarioCount: 3,
    });
    expect(strong).toBeGreaterThan(sparse);
  });

  it("builds a draft scenario that does not imply silent graph mutation", () => {
    const draft = buildTwinScenarioDraftFromPrompt({
      prompt: "Delay top shipment by five days",
      confidenceScore: 72,
      openRiskCount: 1,
      entityKinds: [{ entityKind: "shipment", count: 4 }],
    });
    expect(draft.source).toBe("AMP10_TWIN_ASSISTANT");
    expect(draft.assumptions.join(" ")).toContain("no graph or transaction rows are mutated");
    expect(draft.signals.openRiskCount).toBe(1);
  });

  it("turns risk signals into review playbook copy", () => {
    const summary = buildTwinRiskPlaybookSummary({
      code: "DEMO-RISK",
      severity: "HIGH",
      title: "Supplier disruption",
      detail: null,
    });
    expect(summary).toContain("HIGH twin risk DEMO-RISK");
    expect(summary).toContain("create scenario draft");
  });
});
