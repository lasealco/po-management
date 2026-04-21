import { describe, expect, it } from "vitest";

import { TWIN_SCENARIO_DRAFT_MAX_JSON_BYTES } from "@/lib/supply-chain-twin/schemas/twin-scenario-draft-create";
import { parseTwinScenarioDraftPatchBody } from "@/lib/supply-chain-twin/schemas/twin-scenario-draft-patch";

describe("parseTwinScenarioDraftPatchBody", () => {
  it("rejects empty object", () => {
    const r = parseTwinScenarioDraftPatchBody({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/at least one/i);
  });

  it("accepts title only", () => {
    const r = parseTwinScenarioDraftPatchBody({ title: "  Renamed  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toEqual({ title: "Renamed" });
  });

  it("accepts title null to clear", () => {
    const r = parseTwinScenarioDraftPatchBody({ title: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.title).toBeNull();
  });

  it("accepts draft only", () => {
    const r = parseTwinScenarioDraftPatchBody({ draft: { k: 1 } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.draft).toEqual({ k: 1 });
  });

  it("rejects draft over byte cap", () => {
    const key = "k";
    const padLen = TWIN_SCENARIO_DRAFT_MAX_JSON_BYTES + 50;
    const r = parseTwinScenarioDraftPatchBody({ draft: { [key]: "y".repeat(padLen) } });
    expect(r.ok).toBe(false);
  });
});
