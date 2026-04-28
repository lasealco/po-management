import { describe, expect, it } from "vitest";

import {
  buildAssistantReleaseGate,
  extractAssistantEvidenceItems,
  isWeakAssistantAnswer,
} from "./evidence-quality";

describe("assistant evidence quality helpers", () => {
  it("extracts structured evidence items", () => {
    expect(extractAssistantEvidenceItems([{ label: "SO", href: "/sales-orders/1" }, { nope: true }])).toEqual([
      { label: "SO", href: "/sales-orders/1", excerpt: null },
    ]);
  });

  it("flags weak answers without evidence or object links", () => {
    expect(isWeakAssistantAnswer({ evidence: [], quality: null, feedback: null, objectType: "order", objectId: "1" })).toBe(true);
    expect(isWeakAssistantAnswer({ evidence: [{ label: "Order" }], quality: null, feedback: null, objectType: null, objectId: null })).toBe(true);
    expect(isWeakAssistantAnswer({ evidence: [{ label: "Order" }], quality: null, feedback: "helpful", objectType: "order", objectId: "1" })).toBe(false);
  });

  it("computes release gate status from quality metrics", () => {
    expect(
      buildAssistantReleaseGate({
        auditTotal: 10,
        evidenceBacked: 8,
        feedbackCount: 5,
        weakCount: 2,
        approvedPromptCount: 3,
      }).status,
    ).toBe("PASSED");
    expect(
      buildAssistantReleaseGate({
        auditTotal: 10,
        evidenceBacked: 2,
        feedbackCount: 1,
        weakCount: 8,
        approvedPromptCount: 0,
      }).status,
    ).toBe("BLOCKED");
  });
});
