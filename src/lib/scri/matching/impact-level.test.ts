import { describe, expect, it } from "vitest";

import { scriImpactLevelLabel, scriMatchTier } from "@/lib/scri/matching/impact-level";

describe("impact-level helpers", () => {
  it("labels impact levels", () => {
    expect(scriImpactLevelLabel("HIGH")).toBe("High impact");
    expect(scriImpactLevelLabel("MEDIUM")).toBe("Medium impact");
    expect(scriImpactLevelLabel("LOW")).toBe("Low impact");
    expect(scriImpactLevelLabel(null)).toBeNull();
  });

  it("marks low confidence as tentative", () => {
    expect(scriMatchTier(48, "PO_SHIP_TO_COUNTRY")).toBe("TENTATIVE");
  });

  it("marks region match types as tentative even with higher confidence", () => {
    expect(scriMatchTier(60, "WAREHOUSE_REGION")).toBe("TENTATIVE");
  });

  it("marks strong matches confirmed", () => {
    expect(scriMatchTier(88, "PORT_UNLOC")).toBe("CONFIRMED");
  });
});
