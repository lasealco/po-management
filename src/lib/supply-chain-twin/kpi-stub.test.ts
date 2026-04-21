import { describe, expect, it } from "vitest";

import { TWIN_HEALTH_INDEX_STUB } from "@/lib/supply-chain-twin/kpi-stub";
import { twinHealthIndexStubSchema, twinReadinessResponseSchema } from "@/lib/supply-chain-twin/schemas/twin-readiness-response";

describe("Twin KPI stub (Slice 21)", () => {
  it("exposes a stable non-production health index shape", () => {
    expect(twinHealthIndexStubSchema.parse(TWIN_HEALTH_INDEX_STUB)).toEqual({
      mode: "stub",
      score: 72,
      disclaimer: "non_production",
    });
  });

  it("fits the readiness API envelope", () => {
    const body = {
      ok: true,
      reasons: [] as string[],
      healthIndex: TWIN_HEALTH_INDEX_STUB,
    };
    expect(twinReadinessResponseSchema.parse(body)).toEqual(body);
  });
});
