import { describe, expect, it } from "vitest";

import { parseOnboardingTaskPatchBody } from "./supplier-onboarding-patch";

describe("parseOnboardingTaskPatchBody", () => {
  it("rejects empty body", () => {
    const r = parseOnboardingTaskPatchBody({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/No fields/i);
  });

  it("accepts status done", () => {
    const r = parseOnboardingTaskPatchBody({ status: "done" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.status).toBe("done");
  });

  it("rejects invalid status", () => {
    const r = parseOnboardingTaskPatchBody({ status: "nope" });
    expect(r.ok).toBe(false);
  });

  it("accepts notes only", () => {
    const r = parseOnboardingTaskPatchBody({ notes: "  ok  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.notes).toBe("ok");
  });

  it("accepts explicit null notes", () => {
    const r = parseOnboardingTaskPatchBody({ notes: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.notes).toBeNull();
  });
});
