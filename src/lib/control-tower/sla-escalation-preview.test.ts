import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findManyAlerts = vi.hoisted(() => vi.fn());
const findManyExceptions = vi.hoisted(() => vi.fn());
const findFirstAudit = vi.hoisted(() => vi.fn());
const createNote = vi.hoisted(() => vi.fn());
const createAlert = vi.hoisted(() => vi.fn());
const transaction = vi.hoisted(() => vi.fn());
const writeAudit = vi.hoisted(() => vi.fn());

vi.mock("./audit", () => ({
  writeCtAudit: writeAudit,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ctAlert: { findMany: findManyAlerts },
    ctException: { findMany: findManyExceptions },
    ctAuditLog: { findFirst: findFirstAudit },
    $transaction: transaction,
  },
}));

import { previewSlaEscalationsForTenant, runSlaEscalationsForTenant } from "./sla-escalation";

function txRunner() {
  transaction.mockImplementation(
    async (fn: (tx: { ctShipmentNote: { create: typeof createNote }; ctAlert: { create: typeof createAlert } }) => Promise<void>) => {
      await fn({
        ctShipmentNote: { create: createNote },
        ctAlert: { create: createAlert },
      });
    },
  );
}

function resetMocks() {
  findManyAlerts.mockReset();
  findManyExceptions.mockReset();
  findFirstAudit.mockReset();
  createNote.mockReset();
  createAlert.mockReset();
  transaction.mockReset();
  writeAudit.mockReset();
  findFirstAudit.mockResolvedValue(null);
  writeAudit.mockResolvedValue(undefined);
  txRunner();
}

describe("previewSlaEscalationsForTenant", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
    resetMocks();
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

describe("runSlaEscalationsForTenant", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
    resetMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns preview counts without mutating data when dryRun is true", async () => {
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
    expect(transaction).not.toHaveBeenCalled();
  });

  it("runs ensure path when dryRun is false", async () => {
    const previewRow = {
      shipmentId: "s1",
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      severity: "CRITICAL" as const,
    };
    const ensureAlertRow = {
      id: "alert-1",
      title: "Late",
      severity: "CRITICAL" as const,
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      ownerUserId: "owner-1",
    };
    let alertCalls = 0;
    findManyAlerts.mockImplementation(() => {
      alertCalls += 1;
      if (alertCalls === 1) return Promise.resolve([previewRow]);
      return Promise.resolve([ensureAlertRow]);
    });
    findManyExceptions.mockResolvedValue([]);

    const out = await runSlaEscalationsForTenant({
      tenantId: "tenant-1",
      actorUserId: "actor-1",
      dryRun: false,
    });
    expect(out.dryRun).toBe(false);
    expect(out.shipmentsTouched).toBe(1);
    expect(alertCalls).toBe(2);
    expect(transaction).toHaveBeenCalled();
    expect(writeAudit).toHaveBeenCalled();
  });
});
