import { describe, expect, it } from "vitest";

import { parseTwinRiskSignalAckPatchBody } from "@/lib/supply-chain-twin/schemas/twin-risk-signal-ack-patch";

describe("parseTwinRiskSignalAckPatchBody", () => {
  it("accepts explicit boolean acknowledged", () => {
    const out = parseTwinRiskSignalAckPatchBody({ acknowledged: true });
    expect(out).toEqual({ ok: true, body: { acknowledged: true } });
  });

  it("rejects missing acknowledged", () => {
    const out = parseTwinRiskSignalAckPatchBody({});
    expect(out.ok).toBe(false);
  });

  it("rejects non-boolean acknowledged", () => {
    const out = parseTwinRiskSignalAckPatchBody({ acknowledged: "true" });
    expect(out.ok).toBe(false);
  });
});
