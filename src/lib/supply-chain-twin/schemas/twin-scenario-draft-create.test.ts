import { describe, expect, it } from "vitest";

import {
  parseTwinScenarioDraftCreateBody,
  TWIN_SCENARIO_DRAFT_MAX_JSON_BYTES,
} from "@/lib/supply-chain-twin/schemas/twin-scenario-draft-create";

describe("twinScenarioDraftCreateBodySchema", () => {
  it("accepts empty draft object", () => {
    const r = parseTwinScenarioDraftCreateBody({ draft: {} });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.draft).toEqual({});
  });

  it("rejects draft over byte cap", () => {
    const key = "k";
    const padLen = TWIN_SCENARIO_DRAFT_MAX_JSON_BYTES + 10;
    const r = parseTwinScenarioDraftCreateBody({ draft: { [key]: "y".repeat(padLen) } });
    expect(r.ok).toBe(false);
  });
});
