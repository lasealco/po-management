import { describe, expect, it } from "vitest";

import { parseTwinScenarioDraftDuplicateBody } from "@/lib/supply-chain-twin/schemas/twin-scenario-draft-duplicate";

describe("parseTwinScenarioDraftDuplicateBody", () => {
  it("accepts empty body", () => {
    const r = parseTwinScenarioDraftDuplicateBody({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toEqual({});
  });

  it("treats null raw as empty body", () => {
    const r = parseTwinScenarioDraftDuplicateBody(null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body).toEqual({});
  });

  it("rejects non-object JSON shapes", () => {
    expect(parseTwinScenarioDraftDuplicateBody([]).ok).toBe(false);
    expect(parseTwinScenarioDraftDuplicateBody("x").ok).toBe(false);
  });

  it("trimEnds titleSuffix and keeps leading space for natural titles", () => {
    const r = parseTwinScenarioDraftDuplicateBody({ titleSuffix: "  (copy)  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.titleSuffix).toBe("  (copy)");
  });

  it("rejects titleSuffix over 200 chars", () => {
    const r = parseTwinScenarioDraftDuplicateBody({ titleSuffix: "x".repeat(201) });
    expect(r.ok).toBe(false);
  });
});
