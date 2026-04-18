import { describe, expect, it } from "vitest";

import { summarizeFreeTime, summarizeJsonArray } from "./compare-helpers";

describe("summarizeJsonArray", () => {
  it("handles null and empty array", () => {
    expect(summarizeJsonArray(null)).toBe("—");
    expect(summarizeJsonArray(undefined)).toBe("—");
    expect(summarizeJsonArray([])).toBe("None");
  });

  it("stringifies non-arrays with truncation", () => {
    const long = "x".repeat(200);
    const out = summarizeJsonArray(long);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(140);
  });

  it("joins labeled line items and caps list length", () => {
    const rows = [
      { label: "Ocean freight", amount: 1200 },
      { label: "BAF", amount: 50 },
      { label: "THC", amount: "" },
      { label: "DOC" },
      { label: "A", amount: 1 },
      { label: "B", amount: 2 },
      { label: "C", amount: 3 },
    ];
    const out = summarizeJsonArray(rows, 5);
    expect(out).toContain("Ocean freight (1200)");
    expect(out).toContain("BAF (50)");
    expect(out).toContain("THC");
    expect(out).toContain("(+2 more)");
  });
});

describe("summarizeFreeTime", () => {
  it("handles null and non-objects", () => {
    expect(summarizeFreeTime(null)).toBe("—");
    expect(summarizeFreeTime([])).toMatch(/^\[/);
  });

  it("joins known free-time fields", () => {
    expect(
      summarizeFreeTime({
        demurrageDays: 7,
        detentionDays: 14,
        combinedLabel: "Combined 10",
        notes: "Gate out 48h",
      }),
    ).toBe("Demurrage 7d · Detention 14d · Combined 10 · Gate out 48h");
  });

  it("falls back to truncated JSON when no known keys", () => {
    const o = { other: "x".repeat(200) };
    const out = summarizeFreeTime(o);
    expect(out.endsWith("…")).toBe(true);
  });
});
