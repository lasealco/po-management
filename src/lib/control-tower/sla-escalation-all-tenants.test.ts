import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findManyTenants = vi.hoisted(() => vi.fn());
const findFirstUser = vi.hoisted(() => vi.fn());
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
    tenant: { findMany: findManyTenants },
    user: { findFirst: findFirstUser },
    ctAlert: { findMany: findManyAlerts },
    ctException: { findMany: findManyExceptions },
    ctAuditLog: { findFirst: findFirstAudit },
    $transaction: transaction,
  },
}));

import { runSlaEscalationsAllTenants } from "./sla-escalation";

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

describe("runSlaEscalationsAllTenants", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
    findManyTenants.mockReset();
    findFirstUser.mockReset();
    findManyAlerts.mockReset();
    findManyExceptions.mockReset();
    findFirstAudit.mockReset();
    createNote.mockReset();
    createAlert.mockReset();
    transaction.mockReset();
    writeAudit.mockReset();
    delete process.env.CONTROL_TOWER_SYSTEM_ACTOR_EMAIL;
    findFirstAudit.mockResolvedValue(null);
    writeAudit.mockResolvedValue(undefined);
    txRunner();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns zeros when there are no tenants", async () => {
    findManyTenants.mockResolvedValueOnce([]);
    const s = await runSlaEscalationsAllTenants();
    expect(s).toEqual({ tenants: 0, shipmentsTouched: 0 });
    expect(findFirstUser).not.toHaveBeenCalled();
  });

  it("skips tenants that have no active cron actor user", async () => {
    findManyTenants.mockResolvedValueOnce([{ id: "t1" }]);
    findFirstUser.mockResolvedValueOnce(null);
    const s = await runSlaEscalationsAllTenants();
    expect(s).toEqual({ tenants: 1, shipmentsTouched: 0 });
    expect(findManyAlerts).not.toHaveBeenCalled();
  });

  it("does not touch shipments when nothing is breached", async () => {
    findManyTenants.mockResolvedValueOnce([{ id: "t1" }]);
    findFirstUser.mockResolvedValueOnce({ id: "actor-1" });
    findManyAlerts.mockResolvedValue([
      {
        shipmentId: "s1",
        createdAt: new Date("2026-06-14T12:00:00.000Z"),
        severity: "CRITICAL",
      },
    ]);
    findManyExceptions.mockResolvedValue([]);
    const s = await runSlaEscalationsAllTenants();
    expect(s.shipmentsTouched).toBe(0);
  });

  it("dedupes shipment ids and runs ensure once per id (shared prisma mocks with ensure)", async () => {
    const breachAlert = {
      shipmentId: "s1",
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      severity: "CRITICAL" as const,
    };
    const breachExc = {
      shipmentId: "s1",
      createdAt: new Date("2026-06-02T12:00:00.000Z"),
      severity: "HIGH" as const,
    };
    let alertCalls = 0;
    findManyAlerts.mockImplementation(() => {
      alertCalls += 1;
      if (alertCalls === 1) return Promise.resolve([breachAlert]);
      return Promise.resolve([]);
    });
    let excCalls = 0;
    findManyExceptions.mockImplementation(() => {
      excCalls += 1;
      if (excCalls === 1) return Promise.resolve([breachExc]);
      return Promise.resolve([]);
    });

    findManyTenants.mockResolvedValueOnce([{ id: "t1" }]);
    findFirstUser.mockResolvedValueOnce({ id: "actor-1" });

    const s = await runSlaEscalationsAllTenants();
    expect(s).toEqual({ tenants: 1, shipmentsTouched: 1 });
    expect(alertCalls).toBe(2);
    expect(excCalls).toBe(2);
  });

  it("iterates tenants independently for sweep queries", async () => {
    let alertCalls = 0;
    findManyAlerts.mockImplementation(() => {
      alertCalls += 1;
      if (alertCalls === 1 || alertCalls === 2) {
        return Promise.resolve([
          {
            shipmentId: "s-a",
            createdAt: new Date("2026-06-01T12:00:00.000Z"),
            severity: "CRITICAL" as const,
          },
        ]);
      }
      return Promise.resolve([]);
    });
    let excCalls = 0;
    findManyExceptions.mockImplementation(() => {
      excCalls += 1;
      if (excCalls === 1 || excCalls === 2) return Promise.resolve([]);
      return Promise.resolve([]);
    });

    findManyTenants.mockResolvedValueOnce([{ id: "t-a" }, { id: "t-b" }]);
    findFirstUser.mockResolvedValue({ id: "actor-x" });

    const s = await runSlaEscalationsAllTenants();
    expect(s.tenants).toBe(2);
    expect(s.shipmentsTouched).toBe(1);
    expect(alertCalls).toBe(3);
    expect(excCalls).toBe(3);
  });
});
