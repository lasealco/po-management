import { describe, expect, it } from "vitest";

import { normalizeBf47ReasonCode } from "./billing-bf47";

describe("billing-bf47", () => {
  it("accepts known reason codes case-insensitively", () => {
    expect(normalizeBf47ReasonCode("rate_dispute")).toBe("RATE_DISPUTE");
    expect(normalizeBf47ReasonCode("OTHER")).toBe("OTHER");
  });

  it("rejects unknown codes", () => {
    expect(normalizeBf47ReasonCode("")).toBeNull();
    expect(normalizeBf47ReasonCode("nope")).toBeNull();
  });
});
