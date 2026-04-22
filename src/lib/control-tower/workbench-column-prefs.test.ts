import { describe, expect, it } from "vitest";

import {
  WORKBENCH_TOGGABLE_COLUMNS,
  defaultWorkbenchColumnVisibility,
  parseWorkbenchColumnVisibility,
  workbenchVisibleColumnCount,
} from "./workbench-column-prefs";

describe("defaultWorkbenchColumnVisibility", () => {
  it("enables all togglable columns by default", () => {
    const d = defaultWorkbenchColumnVisibility();
    for (const k of WORKBENCH_TOGGABLE_COLUMNS) {
      expect(d[k]).toBe(true);
    }
  });
});

describe("parseWorkbenchColumnVisibility", () => {
  it("returns empty for null or invalid JSON", () => {
    expect(parseWorkbenchColumnVisibility(null)).toEqual({});
    expect(parseWorkbenchColumnVisibility("not json")).toEqual({});
  });

  it("keeps only known keys with boolean values", () => {
    const raw = JSON.stringify({
      status: false,
      mode: true,
      unknown: false,
      owner: "yes",
    });
    expect(parseWorkbenchColumnVisibility(raw)).toEqual({ status: false, mode: true });
  });
});

describe("workbenchVisibleColumnCount", () => {
  it("counts fixed columns plus visible toggles", () => {
    const allOn = defaultWorkbenchColumnVisibility();
    expect(workbenchVisibleColumnCount(allOn, false)).toBe(2 + WORKBENCH_TOGGABLE_COLUMNS.length);
  });

  it("excludes owner column from count in restricted view", () => {
    const allOn = defaultWorkbenchColumnVisibility();
    const open = workbenchVisibleColumnCount(allOn, false);
    const restricted = workbenchVisibleColumnCount(allOn, true);
    expect(restricted).toBe(open - 1);
  });

  it("subtracts explicitly hidden columns", () => {
    const col = { ...defaultWorkbenchColumnVisibility(), eta: false, lane: false };
    const base = workbenchVisibleColumnCount(defaultWorkbenchColumnVisibility(), false);
    expect(workbenchVisibleColumnCount(col, false)).toBe(base - 2);
  });
});
