import { describe, expect, it } from "vitest";

import {
  forecastGapQty,
  forecastPriorityBoostFromGap,
  parseWeekStartDateInput,
  utcIsoWeekMonday,
} from "./demand-forecast-replenish";

describe("utcIsoWeekMonday", () => {
  it("returns Monday for a Wednesday in UTC", () => {
    const wed = new Date(Date.UTC(2026, 3, 29));
    const mon = utcIsoWeekMonday(wed);
    expect(mon.toISOString().slice(0, 10)).toBe("2026-04-27");
  });
});

describe("parseWeekStartDateInput", () => {
  it("normalizes any day to UTC Monday of that week", () => {
    const r = parseWeekStartDateInput("2026-04-29");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.date.toISOString().slice(0, 10)).toBe("2026-04-27");
  });

  it("rejects bad format", () => {
    const r = parseWeekStartDateInput("04-29-2026");
    expect(r.ok).toBe(false);
  });
});

describe("forecastGapQty", () => {
  it("is zero when pick face covers forecast", () => {
    expect(forecastGapQty(10, 12)).toBe(0);
  });

  it("is positive shortfall", () => {
    expect(forecastGapQty(100, 30)).toBe(70);
  });
});

describe("forecastPriorityBoostFromGap", () => {
  it("tiers gap into boost", () => {
    expect(forecastPriorityBoostFromGap(0)).toBe(0);
    expect(forecastPriorityBoostFromGap(10)).toBe(5);
    expect(forecastPriorityBoostFromGap(50)).toBe(15);
    expect(forecastPriorityBoostFromGap(200)).toBe(30);
    expect(forecastPriorityBoostFromGap(600)).toBe(50);
  });
});
