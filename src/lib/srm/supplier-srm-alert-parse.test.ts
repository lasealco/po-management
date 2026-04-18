import { describe, expect, it } from "vitest";

import { parseSrmAlertCreateBody, parseSrmAlertPatchBody } from "./supplier-srm-alert-parse";

describe("parseSrmAlertCreateBody", () => {
  it("requires title and message", () => {
    expect(parseSrmAlertCreateBody({ title: "x", message: "" }).ok).toBe(false);
  });

  it("defaults severity to warning", () => {
    const r = parseSrmAlertCreateBody({ title: "t", message: "m" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.severity).toBe("warning");
  });
});

describe("parseSrmAlertPatchBody", () => {
  it("rejects empty patch", () => {
    expect(parseSrmAlertPatchBody({}).ok).toBe(false);
  });

  it("accepts status", () => {
    const r = parseSrmAlertPatchBody({ status: "resolved" });
    expect(r.ok).toBe(true);
  });
});
