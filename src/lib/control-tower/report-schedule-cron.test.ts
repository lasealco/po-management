import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CtRunReportResult } from "./report-engine";

const findManySchedules = vi.hoisted(() => vi.fn());
const findManyTenants = vi.hoisted(() => vi.fn());
const updateSchedule = vi.hoisted(() => vi.fn());
const getCtx = vi.hoisted(() => vi.fn());
const runReport = vi.hoisted(() => vi.fn());
const buildCsv = vi.hoisted(() => vi.fn());
const buildPdf = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ctReportSchedule: { findMany: findManySchedules, update: updateSchedule },
    tenant: { findMany: findManyTenants },
  },
}));

vi.mock("@/lib/control-tower/viewer", () => ({
  getControlTowerPortalContext: getCtx,
}));

vi.mock("@/lib/control-tower/report-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/control-tower/report-engine")>();
  return {
    ...actual,
    runControlTowerReport: runReport,
    buildControlTowerReportCsv: buildCsv,
  };
});

vi.mock("@/lib/control-tower/report-pdf", () => ({
  buildControlTowerReportPdfBytes: buildPdf,
}));

import { runControlTowerReportScheduleCron } from "./report-schedule-delivery";

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

function scheduleRow(pick: {
  userActive?: boolean;
  dataset?: "CONTROL_TOWER" | "PO";
  hourUtc?: number;
  lastRunAt?: Date | null;
}) {
  const userActive = pick.userActive ?? true;
  const dataset = pick.dataset ?? "CONTROL_TOWER";
  return {
    id: "sched-1",
    tenantId: "t1",
    userId: "u1",
    savedReportId: "sr1",
    recipientEmail: "ops@example.com",
    frequency: "DAILY" as const,
    hourUtc: pick.hourUtc ?? 8,
    dayOfWeek: null as number | null,
    isActive: true,
    lastRunAt: pick.lastRunAt ?? null,
    lastError: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    savedReport: {
      id: "sr1",
      tenantId: "t1",
      name: "Weekly",
      dataset,
      configJson: { dimension: "month", measure: "shipments" },
    },
    user: { id: "u1", isActive: userActive },
  };
}

describe("runControlTowerReportScheduleCron", () => {
  const savedKey = process.env.RESEND_API_KEY;
  const savedFrom = process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM;
  const fetchMock = vi.fn();

  beforeEach(() => {
    findManySchedules.mockReset();
    findManyTenants.mockReset().mockResolvedValue([]);
    updateSchedule.mockReset();
    getCtx.mockReset();
    runReport.mockReset();
    buildCsv.mockReset();
    buildPdf.mockReset();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (savedKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = savedKey;
    if (savedFrom === undefined) delete process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM;
    else process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM = savedFrom;
  });

  it("returns zero summary when no active schedules", async () => {
    findManySchedules.mockResolvedValueOnce([]);
    const now = new Date("2026-06-15T10:00:00.000Z");
    const s = await runControlTowerReportScheduleCron(now);
    expect(s).toEqual({
      checked: 0,
      due: 0,
      ran: 0,
      emailed: 0,
      skippedInactiveUser: 0,
      skippedNonCtDataset: 0,
      emailDeferredNoConfig: 0,
      failures: 0,
    });
    expect(findManyTenants).not.toHaveBeenCalled();
  });

  it("skips schedules that are not yet due (UTC slot)", async () => {
    findManySchedules.mockResolvedValueOnce([scheduleRow({ hourUtc: 14 })]);
    const now = new Date("2026-06-15T13:30:00.000Z");
    const s = await runControlTowerReportScheduleCron(now);
    expect(s.checked).toBe(1);
    expect(s.due).toBe(0);
    expect(updateSchedule).not.toHaveBeenCalled();
  });

  it("marks lastError when schedule owner is inactive", async () => {
    findManySchedules.mockResolvedValueOnce([scheduleRow({ userActive: false })]);
    const now = new Date("2026-06-15T10:00:00.000Z");
    const s = await runControlTowerReportScheduleCron(now);
    expect(s.due).toBe(1);
    expect(s.skippedInactiveUser).toBe(1);
    expect(updateSchedule).toHaveBeenCalledTimes(1);
    expect(updateSchedule).toHaveBeenCalledWith({
      where: { id: "sched-1" },
      data: {
        lastRunAt: now,
        lastError: "skipped_inactive_schedule_owner",
      },
    });
    expect(runReport).not.toHaveBeenCalled();
  });

  it("skips non-Control Tower saved reports", async () => {
    findManySchedules.mockResolvedValueOnce([scheduleRow({ dataset: "PO" })]);
    const now = new Date("2026-06-15T10:00:00.000Z");
    const s = await runControlTowerReportScheduleCron(now);
    expect(s.skippedNonCtDataset).toBe(1);
    expect(updateSchedule).toHaveBeenCalledWith({
      where: { id: "sched-1" },
      data: { lastRunAt: now, lastError: "skipped_non_control_tower_dataset" },
    });
    expect(runReport).not.toHaveBeenCalled();
  });

  it("runs report, defers email when Resend is not configured, and records lastError", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM;
    findManySchedules.mockResolvedValueOnce([scheduleRow({})]);
    findManyTenants.mockResolvedValueOnce([{ id: "t1", name: "Demo Co" }]);
    getCtx.mockResolvedValueOnce({
      isRestrictedView: false,
      isSupplierPortal: false,
      customerCrmAccountId: null,
    });
    runReport.mockResolvedValueOnce(minimalRunResult());
    buildCsv.mockReturnValueOnce("csv");
    buildPdf.mockResolvedValueOnce(Buffer.from("%PDF"));

    const now = new Date("2026-06-15T10:00:00.000Z");
    const s = await runControlTowerReportScheduleCron(now);

    expect(s.due).toBe(1);
    expect(s.ran).toBe(1);
    expect(s.emailDeferredNoConfig).toBe(1);
    expect(s.failures).toBe(0);
    expect(getCtx).toHaveBeenCalledWith("u1");
    expect(runReport).toHaveBeenCalledWith({
      tenantId: "t1",
      ctx: {
        isRestrictedView: false,
        isSupplierPortal: false,
        customerCrmAccountId: null,
      },
      configInput: { dimension: "month", measure: "shipments" },
      actorUserId: "u1",
    });
    expect(buildCsv).toHaveBeenCalledTimes(1);
    expect(buildPdf).toHaveBeenCalledTimes(1);
    expect(updateSchedule).toHaveBeenCalledWith({
      where: { id: "sched-1" },
      data: {
        lastRunAt: now,
        lastError: "missing_RESEND_API_KEY_or_CONTROL_TOWER_REPORTS_EMAIL_FROM",
      },
    });
  });

  it("clears lastError and counts emailed when Resend succeeds", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM = "reports@example.com";
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    findManySchedules.mockResolvedValueOnce([scheduleRow({})]);
    findManyTenants.mockResolvedValueOnce([{ id: "t1", name: "Demo Co" }]);
    getCtx.mockResolvedValueOnce({
      isRestrictedView: false,
      isSupplierPortal: false,
      customerCrmAccountId: null,
    });
    runReport.mockResolvedValueOnce(minimalRunResult());
    buildCsv.mockReturnValueOnce("csv");
    buildPdf.mockResolvedValueOnce(Buffer.from("%PDF"));

    const now = new Date("2026-06-15T10:00:00.000Z");
    const s = await runControlTowerReportScheduleCron(now);

    expect(s.ran).toBe(1);
    expect(s.emailed).toBe(1);
    expect(s.emailDeferredNoConfig).toBe(0);
    expect(s.failures).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updateSchedule).toHaveBeenCalledWith({
      where: { id: "sched-1" },
      data: { lastRunAt: now, lastError: null },
    });
  });

  it("counts failures when Resend returns an error status", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.CONTROL_TOWER_REPORTS_EMAIL_FROM = "reports@example.com";
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response("bad", { status: 422 }));

    findManySchedules.mockResolvedValueOnce([scheduleRow({})]);
    findManyTenants.mockResolvedValueOnce([{ id: "t1", name: "Demo Co" }]);
    getCtx.mockResolvedValueOnce({
      isRestrictedView: false,
      isSupplierPortal: false,
      customerCrmAccountId: null,
    });
    runReport.mockResolvedValueOnce(minimalRunResult());
    buildCsv.mockReturnValueOnce("csv");
    buildPdf.mockResolvedValueOnce(Buffer.from("%PDF"));

    const now = new Date("2026-06-15T10:00:00.000Z");
    const s = await runControlTowerReportScheduleCron(now);

    expect(s.ran).toBe(1);
    expect(s.emailed).toBe(0);
    expect(s.failures).toBe(1);
    expect(s.emailDeferredNoConfig).toBe(0);
    expect(updateSchedule).toHaveBeenCalledWith({
      where: { id: "sched-1" },
      data: expect.objectContaining({
        lastRunAt: now,
        lastError: expect.stringMatching(/^resend_http_422:/),
      }),
    });
  });
});
