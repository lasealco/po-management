import { describe, expect, it } from "vitest";

import {
  parseComplianceReviewCreateBody,
  parseComplianceReviewPatchBody,
} from "./supplier-compliance-review-parse";

describe("parseComplianceReviewCreateBody", () => {
  it("requires summary and valid outcome", () => {
    expect(parseComplianceReviewCreateBody({ outcome: "satisfactory", summary: "" }).ok).toBe(
      false,
    );
    expect(parseComplianceReviewCreateBody({ outcome: "nope", summary: "ok" }).ok).toBe(false);
  });

  it("accepts minimal valid body", () => {
    const r = parseComplianceReviewCreateBody({ outcome: "action_required", summary: " gaps " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.outcome).toBe("action_required");
      expect(r.data.summary).toBe("gaps");
      expect(r.data.nextReviewDue).toBeNull();
    }
  });
});

describe("parseComplianceReviewPatchBody", () => {
  it("rejects empty patch", () => {
    expect(parseComplianceReviewPatchBody({}).ok).toBe(false);
  });

  it("accepts outcome only", () => {
    const r = parseComplianceReviewPatchBody({ outcome: "failed" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.outcome).toBe("failed");
  });
});
