import { describe, expect, it } from "vitest";

import {
  isLaborVarianceExceeded,
  parseLaborVariancePolicyBf77Json,
  validateLaborVariancePolicyDraftFromPost,
} from "./labor-variance-bf77";

describe("labor-variance-bf77", () => {
  it("parseLaborVariancePolicyBf77Json(null) disables queue", () => {
    const r = parseLaborVariancePolicyBf77Json(null);
    expect(r.policy.enabled).toBe(false);
    expect(r.policy.excessPercentThreshold).toBe(25);
  });

  it("isLaborVarianceExceeded respects threshold and floors", () => {
    const p = parseLaborVariancePolicyBf77Json({
      enabled: true,
      excessPercentThreshold: 25,
      minActualMinutes: 3,
      minStandardMinutes: 1,
    }).policy;
    expect(isLaborVarianceExceeded(10, 12, p)).toBe(false);
    expect(isLaborVarianceExceeded(16, 12, p)).toBe(true);
    expect(isLaborVarianceExceeded(2, 12, p)).toBe(false);
  });

  it("validateLaborVariancePolicyDraftFromPost rejects out-of-range fields", () => {
    const bad = validateLaborVariancePolicyDraftFromPost({
      enabled: true,
      taskTypes: "not-array" as unknown as string[],
    });
    expect(bad.ok).toBe(false);
    const ok = validateLaborVariancePolicyDraftFromPost({
      enabled: true,
      excessPercentThreshold: 30,
      lookbackDays: 7,
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.policy.excessPercentThreshold).toBe(30);
    expect(ok.policy.lookbackDays).toBe(7);
  });
});
