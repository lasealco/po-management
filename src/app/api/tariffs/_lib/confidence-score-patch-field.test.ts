import { describe, expect, it } from "vitest";

import { confidenceScoreFromPatchBody } from "./confidence-score-patch-field";

describe("confidenceScoreFromPatchBody", () => {
  it("returns empty patch when key is absent", () => {
    expect(confidenceScoreFromPatchBody({})).toEqual({ ok: true, patch: {} });
    expect(confidenceScoreFromPatchBody({ parseStatus: "PARSED_OK" })).toEqual({ ok: true, patch: {} });
  });

  it("accepts null and finite 0–100", () => {
    expect(confidenceScoreFromPatchBody({ confidenceScore: null })).toEqual({
      ok: true,
      patch: { confidenceScore: null },
    });
    expect(confidenceScoreFromPatchBody({ confidenceScore: 0 })).toEqual({
      ok: true,
      patch: { confidenceScore: 0 },
    });
    expect(confidenceScoreFromPatchBody({ confidenceScore: 100 })).toEqual({
      ok: true,
      patch: { confidenceScore: 100 },
    });
    expect(confidenceScoreFromPatchBody({ confidenceScore: 0.92 })).toEqual({
      ok: true,
      patch: { confidenceScore: 0.92 },
    });
  });

  it("rejects non-numbers, non-finite, and out-of-range values", () => {
    expect(confidenceScoreFromPatchBody({ confidenceScore: "0.9" })).toMatchObject({ ok: false });
    expect(confidenceScoreFromPatchBody({ confidenceScore: Number.NaN })).toMatchObject({ ok: false });
    expect(confidenceScoreFromPatchBody({ confidenceScore: -0.01 })).toMatchObject({ ok: false });
    expect(confidenceScoreFromPatchBody({ confidenceScore: 100.01 })).toMatchObject({ ok: false });
  });
});
