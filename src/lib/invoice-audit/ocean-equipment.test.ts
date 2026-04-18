import { describe, expect, it } from "vitest";

import { equipmentMatches, normalizeEquipmentKey, parseEquipmentFromText } from "@/lib/invoice-audit/ocean-equipment";

describe("ocean-equipment", () => {
  it("normalizes common FCL strings", () => {
    expect(normalizeEquipmentKey("40HC")).toBe("40HC");
    expect(normalizeEquipmentKey(" 40 hc ")).toBe("40HC");
    expect(normalizeEquipmentKey("40' HC")).toBeTruthy();
  });

  it("parses equipment from invoice text", () => {
    expect(parseEquipmentFromText("Ocean freight 40HC all-in")).toBe("40HC");
    expect(parseEquipmentFromText("Freight line 20DV")).toBe("20DV");
  });

  it("classifies equipment match vs mismatch", () => {
    expect(equipmentMatches("40HC", "40HC")).toBe("MATCH");
    expect(equipmentMatches("40HC", null)).toBe("NEUTRAL");
    expect(equipmentMatches("40HC", "20DV")).toBe("MISMATCH");
  });
});
