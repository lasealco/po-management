import type { CtReportSchedule } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { CtRunReportResult } from "./report-engine";
import { formatReportRunForEmail, isReportScheduleDue } from "./report-schedule-delivery";

function sched(pick: Pick<CtReportSchedule, "frequency" | "hourUtc"> & Partial<CtReportSchedule>): CtReportSchedule {
  return {
    id: "sched-1",
    tenantId: "t1",
    createdAt: new Date(),
    updatedAt: new Date(),
    reportName: "R1",
    toEmail: "a@b.c",
    configJson: {},
    dayOfWeek: null,
    lastRunAt: null,
    ...pick,
  } as CtReportSchedule;
}

function minimalRunResult(overrides: Partial<CtRunReportResult> = {}): CtRunReportResult {
  return {
    config: {
      chartType: "bar",
      dimension: "month",
      measure: "shipments",
      compareMeasure: null,
      dateField: "shippedAt",
      dateFrom: null,
      dateTo: null,
      topN: 12,
      title: "Ops weekly",
    },
    rows: [
      {
        key: "2026-03",
        label: "2026-03",
        metrics: {
          shipments: 2,
          volumeCbm: 1.5,
          weightKg: 10,
          shippingSpend: 20,
          onTimePct: 90,
          avgDelayDays: 0.1,
          openExceptions: 1,
        },
      },
    ],
    fullSeriesRows: [],
    coverage: {
      totalShipmentsQueried: 20,
      shipmentsAggregated: 10,
      excludedByDateOrMissingDateField: 2,
      dimensionGroupsTotal: 5,
      dimensionGroupsShown: 5,
    },
    totals: {
      shipments: 10,
      volumeCbm: 2,
      weightKg: 100,
      shippingSpend: 50.25,
      onTimePct: 85.5,
      avgDelayDays: 0.5,
      openExceptions: 3,
    },
    generatedAt: "2026-04-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("isReportScheduleDue", () => {
  it("returns false before the UTC hour slot starts", () => {
    const s = sched({ frequency: "DAILY", hourUtc: 14, lastRunAt: null });
    const now = new Date("2026-06-15T13:30:00.000Z");
    expect(isReportScheduleDue(s, now)).toBe(false);
  });

  it("returns true on first run after slot when lastRunAt is null", () => {
    const s = sched({ frequency: "DAILY", hourUtc: 8, lastRunAt: null });
    const now = new Date("2026-06-15T10:00:00.000Z");
    expect(isReportScheduleDue(s, now)).toBe(true);
  });

  it("returns false when already ran today (UTC)", () => {
    const s = sched({
      frequency: "DAILY",
      hourUtc: 6,
      lastRunAt: new Date("2026-06-15T09:00:00.000Z"),
    });
    const now = new Date("2026-06-15T18:00:00.000Z");
    expect(isReportScheduleDue(s, now)).toBe(false);
  });

  it("returns true when last run was on a prior UTC day", () => {
    const s = sched({
      frequency: "DAILY",
      hourUtc: 6,
      lastRunAt: new Date("2026-06-14T20:00:00.000Z"),
    });
    const now = new Date("2026-06-15T10:00:00.000Z");
    expect(isReportScheduleDue(s, now)).toBe(true);
  });

  it("WEEKLY: false when dayOfWeek is unset", () => {
    const s = sched({ frequency: "WEEKLY", hourUtc: 8, dayOfWeek: null, lastRunAt: null });
    const now = new Date("2026-06-15T10:00:00.000Z");
    expect(isReportScheduleDue(s, now)).toBe(false);
  });

  it("WEEKLY: false on wrong weekday", () => {
    const s = sched({ frequency: "WEEKLY", hourUtc: 8, dayOfWeek: 0, lastRunAt: null });
    const now = new Date("2026-06-15T10:00:00.000Z");
    expect(now.getUTCDay()).toBe(1);
    expect(isReportScheduleDue(s, now)).toBe(false);
  });

  it("WEEKLY: true on matching weekday after slot", () => {
    const s = sched({ frequency: "WEEKLY", hourUtc: 8, dayOfWeek: 1, lastRunAt: null });
    const now = new Date("2026-06-15T10:00:00.000Z");
    expect(isReportScheduleDue(s, now)).toBe(true);
  });
});

describe("formatReportRunForEmail", () => {
  it("builds subject and body with org prefix and row preview", () => {
    const { subject, text } = formatReportRunForEmail(minimalRunResult(), "Saved name", {
      organizationName: "  Demo Co  ",
    });
    expect(subject.startsWith("[Control Tower]")).toBe(true);
    expect(subject).toContain("Demo Co");
    expect(subject).toContain("Ops weekly");
    expect(text).toContain("shipments aggregated");
    expect(text).toContain("2026-03");
    expect(text).toContain("shipments=2");
  });

  it("uses reportName when config title is blank", () => {
    const base = minimalRunResult();
    const r: CtRunReportResult = {
      ...base,
      config: { ...base.config, title: "   " },
    };
    const { subject } = formatReportRunForEmail(r, "Fallback title");
    expect(subject).toContain("Fallback title");
  });
});
