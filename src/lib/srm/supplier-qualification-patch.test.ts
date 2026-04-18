import { describe, expect, it } from "vitest";

import { parseSupplierQualificationFields } from "./supplier-qualification-patch";

describe("parseSupplierQualificationFields", () => {
  it("returns none when no qualification keys", () => {
    expect(parseSupplierQualificationFields({ name: "x" }).kind).toBe("none");
  });

  it("accepts status + summary", () => {
    const r = parseSupplierQualificationFields({
      qualificationStatus: "conditional",
      qualificationSummary: "  OK  ",
    });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.data.qualificationStatus).toBe("conditional");
      expect(r.data.qualificationSummary).toBe("OK");
    }
  });

  it("rejects invalid status", () => {
    const r = parseSupplierQualificationFields({ qualificationStatus: "maybe" });
    expect(r.kind).toBe("error");
  });
});
