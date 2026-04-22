import { beforeEach, describe, expect, it, vi } from "vitest";

const ctSlaBreachedMock = vi.hoisted(() => vi.fn());
const ctSlaAgeHoursMock = vi.hoisted(() => vi.fn());
const ctSlaThresholdHoursMock = vi.hoisted(() => vi.fn());

vi.mock("./sla-thresholds", () => ({
  ctSlaBreached: (...args: unknown[]) => ctSlaBreachedMock(...args),
  ctSlaAgeHours: (...args: unknown[]) => ctSlaAgeHoursMock(...args),
  ctSlaThresholdHours: (...args: unknown[]) => ctSlaThresholdHoursMock(...args),
}));

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

import { ensureSlaEscalationsForShipment } from "./sla-escalation";

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

describe("ensureSlaEscalationsForShipment", () => {
  beforeEach(() => {
    findManyAlerts.mockReset();
    findManyExceptions.mockReset();
    findFirstAudit.mockReset();
    createNote.mockReset();
    createAlert.mockReset();
    transaction.mockReset();
    writeAudit.mockReset();
    ctSlaBreachedMock.mockReset();
    ctSlaAgeHoursMock.mockReset();
    ctSlaThresholdHoursMock.mockReset();

    findManyAlerts.mockResolvedValue([]);
    findManyExceptions.mockResolvedValue([]);
    findFirstAudit.mockResolvedValue(null);
    writeAudit.mockResolvedValue(undefined);
    ctSlaAgeHoursMock.mockReturnValue(48);
    ctSlaThresholdHoursMock.mockReturnValue(24);
    txRunner();
  });

  it("does nothing when no open alerts or exceptions", async () => {
    ctSlaBreachedMock.mockReturnValue(true);
    await ensureSlaEscalationsForShipment({
      tenantId: "t1",
      shipmentId: "s1",
      actorUserId: "u1",
    });
    expect(transaction).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("skips alerts that are not past SLA", async () => {
    ctSlaBreachedMock.mockReturnValue(false);
    findManyAlerts.mockResolvedValue([
      {
        id: "a1",
        title: "Doc",
        severity: "MEDIUM",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        ownerUserId: "owner-1",
      },
    ]);
    await ensureSlaEscalationsForShipment({ tenantId: "t1", shipmentId: "s1", actorUserId: "u1" });
    expect(findFirstAudit).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("skips escalation when the same source entity was escalated within the dedupe window", async () => {
    ctSlaBreachedMock.mockReturnValue(true);
    findManyAlerts.mockResolvedValue([
      {
        id: "a1",
        title: "Late",
        severity: "HIGH",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        ownerUserId: "owner-1",
      },
    ]);
    findFirstAudit.mockResolvedValue({ id: "audit-1" });
    await ensureSlaEscalationsForShipment({ tenantId: "t1", shipmentId: "s1", actorUserId: "u1" });
    expect(findFirstAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          entityType: "CtAlert",
          entityId: "a1",
          action: "sla_escalation",
        }),
      }),
    );
    expect(transaction).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("creates internal note, SLA follow-up alert, and audit for a breached alert", async () => {
    ctSlaBreachedMock.mockReturnValue(true);
    findManyAlerts.mockResolvedValue([
      {
        id: "a1",
        title: "Missing BOL",
        severity: "HIGH",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        ownerUserId: "owner-1",
      },
    ]);

    await ensureSlaEscalationsForShipment({ tenantId: "t1", shipmentId: "s1", actorUserId: "actor-1" });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(createNote).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "t1",
        shipmentId: "s1",
        visibility: "INTERNAL",
        createdById: "actor-1",
        body: expect.stringContaining("[SLA_ESCALATION]"),
      }),
    });
    expect(createAlert).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "t1",
        shipmentId: "s1",
        type: "SLA_ESCALATION",
        severity: "CRITICAL",
        status: "OPEN",
        ownerUserId: "owner-1",
        title: expect.stringContaining("SLA breach follow-up"),
      }),
    });
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "t1",
        shipmentId: "s1",
        entityType: "CtAlert",
        entityId: "a1",
        action: "sla_escalation",
        actorUserId: "actor-1",
        payload: { kind: "alert", ageHours: 48, thresholdHours: 24 },
      }),
    );
  });

  it("escalates breached exceptions the same way", async () => {
    ctSlaBreachedMock.mockReturnValue(true);
    findManyExceptions.mockResolvedValue([
      {
        id: "e1",
        type: "LATE_DOC",
        severity: "HIGH",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        ownerUserId: "owner-2",
      },
    ]);

    await ensureSlaEscalationsForShipment({ tenantId: "t1", shipmentId: "s1", actorUserId: "actor-1" });

    expect(createNote).toHaveBeenCalledWith({
      data: expect.objectContaining({
        body: expect.stringContaining("Exception \"LATE_DOC\""),
      }),
    });
    expect(createAlert).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: expect.stringContaining("exception LATE_DOC"),
      }),
    });
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "CtException",
        entityId: "e1",
        payload: { kind: "exception", ageHours: 48, thresholdHours: 24 },
      }),
    );
  });
});
