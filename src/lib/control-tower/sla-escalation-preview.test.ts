import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findManyAlerts = vi.hoisted(() => vi.fn());
const findManyExceptions = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ctAlert: { findMany: findManyAlerts },
    ctException: { findMany: findManyExceptions },
  },
}));

import { previewSlaEscalationsForTenant, runSlaEscalationsForTenant } from "./sla-escalation";

describe("previewSlaEscalationsForTenant", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
    findManyAlerts.mockReset();
    findManyExceptions.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("collects unique shipment ids only for SLA-breached open items", async () => {
    findManyAlerts.mockResolvedValue([
      {
        shipmentId: "s-breach",
        createdAt: new Date("2026-06-01T12:00:00.000Z"),
        severity: "CRITICAL",
      },
      {
        shipmentId: "s-ok",
        createdAt: new Date("2026-06-14T12:00:00.000Z"),
        severity: "CRITICAL",
      },
    ]);
    findManyExceptions.mockResolvedValue([
      {
        shipmentId: "s-breach",
        createdAt: new Date("2026-06-02T12:00:00.000Z"),
        severity: "WARN",
      },
    ]);
    const out = await previewSlaEscalationsForTenant("tenant-1");
    expect(out.shipmentIds.sort()).toEqual(["s-breach"]);
    expect(out.openAlertCandidates).toBe(2);
    expect(out.openExceptionCandidates).toBe(1);
  });
});

describe("runSlaEscalationsForTenant dryRun", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
    findManyAlerts.mockReset();
    findManyExceptions.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns preview counts without mutating data", async () => {
    findManyAlerts.mockResolvedValue([
      {
        shipmentId: "s1",
        createdAt: new Date("2026-06-01T12:00:00.000Z"),
        severity: "CRITICAL",
      },
    ]);
    findManyExceptions.mockResolvedValue([]);
    const out = await runSlaEscalationsForTenant({
      tenantId: "tenant-1",
      actorUserId: "actor-1",
      dryRun: true,
    });
    expect(out.dryRun).toBe(true);
    expect(out.shipmentsTouched).toBe(1);
    expect(out.openAlertCandidates).toBe(1);
    expect(out.openExceptionCandidates).toBe(0);
  });
});
