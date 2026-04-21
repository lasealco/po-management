import { describe, expect, it } from "vitest";

import { TWIN_RISK_SEVERITY_ORDER } from "@/lib/supply-chain-twin/risk";

describe("TwinRiskSeverity (Slice 22)", () => {
  it("exposes a stable severity ordering list", () => {
    expect(TWIN_RISK_SEVERITY_ORDER).toEqual(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  });
});
