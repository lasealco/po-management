import type { CtReportSchedule } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CtRunReportResult } from "./report-engine";
import {
  formatReportRunForEmail,
  isReportScheduleDue,
  parseScheduleFrequency,
  sendScheduledReportEmail,
} from "./report-schedule-delivery";

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
          openExceptionRatePct: 50,
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
      openExceptionRatePct: 33.33,
    },
    generatedAt: "2026-04-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("parseScheduleFrequency", () => {
  it("accepts DAILY and WEEKLY", () => {
    expect(parseScheduleFrequency("DAILY")).toBe("DAILY");
    expect(parseScheduleFrequency("WEEKLY")).toBe("WEEKLY");
  });

  it("returns null for unknown or non-string values", () => {
    expect(parseScheduleFrequency("MONTHLY")).toBeNull();
    expect(parseScheduleFrequency("")).toBeNull();
    expect(parseScheduleFrequency(null)).toBeNull();
    expect(parseScheduleFrequency(undefined)).toBeNull();
    expect(parseScheduleFrequency(1)).toBeNull();
  });
});

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

describe("sendScheduledReportEmail", () => {
  const savedKey = process.env.RESEND_API_KEY;
  const savedFrom = process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM;
  const fetchMock = vi.fn();

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    if (savedKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = savedKey;
    if (savedFrom === undefined) delete process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM;
    else process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM = savedFrom;
  });

  it("returns failure when Resend env is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM;
    const r = await sendScheduledReportEmail({ to: "ops@example.com", subject: "S", text: "Body" });
    expect(r).toEqual({
      ok: false,
      reason: "missing_RESEND_API_KEY_or_CONTROL_TOWER_REPORTS_EMAIL_FROM",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to Resend and returns ok when HTTP 200", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM = "reports@example.com";
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    const r = await sendScheduledReportEmail({
      to: "a@b.co",
      subject: "Hello",
      text: "Line",
      attachments: [{ filename: "a.csv", contentBase64: "YWI=" }],
    });

    expect(r).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body.from).toBe("reports@example.com");
    expect(body.to).toEqual(["a@b.co"]);
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0].filename).toBe("a.csv");
  });

  it("returns resend_http reason when API responds with error status", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM = "reports@example.com";
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response("bad request", { status: 422 }));

    const r = await sendScheduledReportEmail({ to: "a@b.co", subject: "S", text: "T" });
    expect(r).toEqual({ ok: false, reason: "resend_http_422:bad request" });
  });
});
