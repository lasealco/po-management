import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tenantId = "tenant-test";
const actorUserId = "actor-test";
const shipmentId = "ship-test-1";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    ctAuditLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    shipment: {
      findFirst: vi.fn(),
    },
    ctTrackingMilestone: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { processControlTowerInboundWebhook } from "@/lib/control-tower/inbound-webhook";

type CreateArgs = { data: { entityType?: string; payload?: unknown } };

/** Captures `replayResponse` written with `INBOUND_WEBHOOK_EVENT` for replay tests. */
const storedIdempotentReplay: { current: Record<string, unknown> | null } = { current: null };

let idempotencyReplayMode = false;

beforeEach(() => {
  delete process.env.CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS;
  idempotencyReplayMode = false;
  storedIdempotentReplay.current = null;
  vi.clearAllMocks();

  prismaMock.ctAuditLog.findFirst.mockImplementation(async () => {
    if (idempotencyReplayMode && storedIdempotentReplay.current) {
      return { payload: { replayResponse: storedIdempotentReplay.current } };
    }
    return null;
  });

  prismaMock.ctAuditLog.create.mockImplementation(async (args: CreateArgs) => {
    const { entityType, payload } = args.data;
    if (entityType === "INBOUND_WEBHOOK_EVENT" && payload && typeof payload === "object") {
      const replay = (payload as Record<string, unknown>).replayResponse;
      if (replay && typeof replay === "object" && !Array.isArray(replay)) {
        storedIdempotentReplay.current = replay as Record<string, unknown>;
      }
    }
    return {};
  });

  prismaMock.shipment.findFirst.mockResolvedValue({ id: shipmentId });
  prismaMock.ctTrackingMilestone.findFirst.mockResolvedValue(null);
  prismaMock.ctTrackingMilestone.create.mockResolvedValue({ id: "mile-created-1" });
});

afterEach(() => {
  delete process.env.CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS;
});

function rowTemplate(overrides: Record<string, unknown> = {}) {
  return {
    shipment_id: shipmentId,
    event_code: "PICKUP",
    event_time: "2026-01-10T12:00:00.000Z",
    ...overrides,
  };
}

describe("processControlTowerInboundWebhook", () => {
  describe("idempotencyKey replay vs first-time processing", () => {
    it("returns 200 with stored body and idempotentReplay on second POST with same key", async () => {
      const body: Record<string, unknown> = {
        idempotencyKey: "idem-canonical-1",
        shipmentId,
        milestone: {
          code: "GATE_IN",
          actualAt: "2026-02-01T15:00:00.000Z",
        },
      };

      const first = await processControlTowerInboundWebhook({ tenantId, actorUserId, body });
      expect(first.status).toBe(200);
      expect(first.body.idempotentReplay).toBeUndefined();
      expect(first.body.ok).toBe(true);
      expect(storedIdempotentReplay.current).toBeTruthy();
      expect(storedIdempotentReplay.current).toMatchObject({
        ok: true,
        shipmentId,
        milestoneId: "mile-created-1",
        milestoneCreated: true,
      });

      const shipmentCallsAfterFirst = prismaMock.shipment.findFirst.mock.calls.length;
      const milestoneCreatesAfterFirst = prismaMock.ctTrackingMilestone.create.mock.calls.length;

      idempotencyReplayMode = true;
      const second = await processControlTowerInboundWebhook({ tenantId, actorUserId, body });
      expect(second.status).toBe(200);
      expect(second.body.idempotentReplay).toBe(true);
      expect(second.body).toEqual({
        ...(storedIdempotentReplay.current as Record<string, unknown>),
        idempotentReplay: true,
      });
      expect(prismaMock.shipment.findFirst.mock.calls.length).toBe(shipmentCallsAfterFirst);
      expect(prismaMock.ctTrackingMilestone.create.mock.calls.length).toBe(milestoneCreatesAfterFirst);
    });

    it("returns 200 with idempotentReplay for carrier_webhook_v1 on second POST with same key", async () => {
      const data = [
        rowTemplate(),
        rowTemplate({
          event_code: "DELIVERED",
          event_time: "2026-01-11T14:00:00.000Z",
        }),
      ];
      const body: Record<string, unknown> = {
        idempotencyKey: "idem-carrier-batch-1",
        payloadFormat: "carrier_webhook_v1",
        data,
      };

      const first = await processControlTowerInboundWebhook({ tenantId, actorUserId, body });
      expect(first.status).toBe(200);
      expect(first.body.idempotentReplay).toBeUndefined();
      expect(first.body).toMatchObject({
        ok: true,
        maxBatchRows: 50,
        rowCount: 2,
        milestonesProcessed: 2,
      });
      expect(storedIdempotentReplay.current).toBeTruthy();
      expect(storedIdempotentReplay.current).toMatchObject({
        ok: true,
        rowCount: 2,
        maxBatchRows: 50,
      });

      const shipmentCallsAfterFirst = prismaMock.shipment.findFirst.mock.calls.length;
      const milestoneCreatesAfterFirst = prismaMock.ctTrackingMilestone.create.mock.calls.length;

      idempotencyReplayMode = true;
      const second = await processControlTowerInboundWebhook({ tenantId, actorUserId, body });
      expect(second.status).toBe(200);
      expect(second.body.idempotentReplay).toBe(true);
      expect(second.body).toEqual({
        ...(storedIdempotentReplay.current as Record<string, unknown>),
        idempotentReplay: true,
      });
      expect(prismaMock.shipment.findFirst.mock.calls.length).toBe(shipmentCallsAfterFirst);
      expect(prismaMock.ctTrackingMilestone.create.mock.calls.length).toBe(milestoneCreatesAfterFirst);
    });
  });

  describe("carrier_webhook_v1 batch cap", () => {
    it("rejects when data.length exceeds default max (50) and echoes maxBatchRows", async () => {
      const data = Array.from({ length: 51 }, () => rowTemplate());
      const res = await processControlTowerInboundWebhook({
        tenantId,
        actorUserId,
        body: { payloadFormat: "carrier_webhook_v1", data },
      });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: expect.stringContaining("at most 50"),
        maxBatchRows: 50,
        payloadFormat: "carrier_webhook_v1",
      });
      expect(prismaMock.shipment.findFirst).not.toHaveBeenCalled();
    });

    it("uses CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS for cap and JSON maxBatchRows", async () => {
      process.env.CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS = "3";
      const data = Array.from({ length: 4 }, () => rowTemplate());
      const res = await processControlTowerInboundWebhook({
        tenantId,
        actorUserId,
        body: { payloadFormat: "carrier_webhook_v1", data },
      });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: expect.stringContaining("at most 3"),
        maxBatchRows: 3,
        payloadFormat: "carrier_webhook_v1",
      });
    });

    it("accepts carrier_webhook_v1 when data.length equals resolved maxBatchRows", async () => {
      process.env.CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS = "4";
      const data = Array.from({ length: 4 }, (_, i) =>
        rowTemplate({
          event_code: i === 0 ? "PICKUP" : "IN_TRANSIT",
          event_time: `2026-01-10T1${i}:00:00.000Z`,
        }),
      );
      const res = await processControlTowerInboundWebhook({
        tenantId,
        actorUserId,
        body: { payloadFormat: "carrier_webhook_v1", data },
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        ok: true,
        maxBatchRows: 4,
        rowCount: 4,
        milestonesProcessed: 4,
        milestonesFailed: 0,
      });
    });

    it("clamps CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS to 200 when env is higher", async () => {
      process.env.CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS = "500";
      const data = Array.from({ length: 201 }, () => rowTemplate());
      const res = await processControlTowerInboundWebhook({
        tenantId,
        actorUserId,
        body: { payloadFormat: "carrier_webhook_v1", data },
      });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: expect.stringContaining("at most 200"),
        maxBatchRows: 200,
        payloadFormat: "carrier_webhook_v1",
      });
      expect(prismaMock.shipment.findFirst).not.toHaveBeenCalled();
    });

    it("returns 400 for empty data array without shipment reads", async () => {
      const res = await processControlTowerInboundWebhook({
        tenantId,
        actorUserId,
        body: { payloadFormat: "carrier_webhook_v1", data: [] },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("non-empty array");
      expect(prismaMock.shipment.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("payload formats (happy path)", () => {
    it("accepts generic_carrier_v1 and upserts milestone", async () => {
      const res = await processControlTowerInboundWebhook({
        tenantId,
        actorUserId,
        body: {
          payloadFormat: "generic_carrier_v1",
          carrierPayload: {
            shipment_id: shipmentId,
            event_code: "OUT_GATE",
            event_time: "2026-03-01T09:30:00.000Z",
            message: "Left terminal",
          },
        },
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.milestoneId).toBe("mile-created-1");
      expect(prismaMock.ctTrackingMilestone.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shipmentId,
            code: "OUT_GATE",
            sourceType: "INTEGRATION",
          }),
        }),
      );
    });

    it("accepts visibility_flat_v1", async () => {
      const res = await processControlTowerInboundWebhook({
        tenantId,
        actorUserId,
        body: {
          payloadFormat: "visibility_flat_v1",
          visibilityPayload: {
            shipmentId,
            statusCode: "IN_TRANSIT",
            occurredAt: "2026-03-02T11:00:00.000Z",
            description: "En route",
          },
        },
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(prismaMock.ctTrackingMilestone.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: "IN_TRANSIT",
            notes: "En route",
          }),
        }),
      );
    });

    it("accepts tms_event_v1", async () => {
      const res = await processControlTowerInboundWebhook({
        tenantId,
        actorUserId,
        body: {
          payloadFormat: "tms_event_v1",
          tmsPayload: {
            shipment_id: shipmentId,
            milestone_code: "DELIVERED",
            actual_at: "2026-03-03T18:45:00.000Z",
            remarks: "POD captured",
            correlation_id: "corr-99",
          },
        },
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(prismaMock.ctTrackingMilestone.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: "DELIVERED",
            sourceRef: "corr-99",
          }),
        }),
      );
    });

    it("accepts sea_port_track_v1 (carrier mapper → generic_carrier_v1)", async () => {
      const res = await processControlTowerInboundWebhook({
        tenantId,
        actorUserId,
        body: {
          payloadFormat: "sea_port_track_v1",
          event: "seaport.push",
          seaPortEvent: {
            consignmentCuid: shipmentId,
            activityType: "DISCH",
            eventTimestamp: "2026-04-01T16:30:00.000Z",
            freeText: "Discharge start",
            eventRef: "t-disch-1",
          },
        },
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(prismaMock.ctTrackingMilestone.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: "PORT_DISCH",
            notes: "Discharge start",
            sourceRef: "t-disch-1",
          }),
        }),
      );
    });

    it("accepts simple_carrier_event_v1 (flat → generic_carrier_v1)", async () => {
      const res = await processControlTowerInboundWebhook({
        tenantId,
        actorUserId,
        body: {
          payloadFormat: "simple_carrier_event_v1",
          event: "simple.push",
          shipmentId,
          eventCode: "GATE_IN",
          eventTime: "2026-04-10T10:00:00.000Z",
          message: "At CY",
        },
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(prismaMock.ctTrackingMilestone.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: "GATE_IN",
            notes: "At CY",
          }),
        }),
      );
    });
  });

  describe("400 without DB reads (shape / missing shipment id)", () => {
    it("returns 400 for unknown payloadFormat before tenant/shipment checks", async () => {
      const res = await processControlTowerInboundWebhook({
        tenantId,
        actorUserId,
        body: { payloadFormat: "alien_v9", shipmentId, event: "x" },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Unknown payloadFormat");
      expect(String(res.body.error)).toContain("sea_port_track_v1");
      expect(String(res.body.error)).toContain("simple_carrier_event_v1");
      expect(prismaMock.shipment.findFirst).not.toHaveBeenCalled();
    });

    it("returns 400 for sea_port_track_v1 without seaPortEvent", async () => {
      const res = await processControlTowerInboundWebhook({
        tenantId,
        actorUserId,
        body: { payloadFormat: "sea_port_track_v1" },
      });
      expect(res.status).toBe(400);
      expect(String(res.body.error)).toContain("seaPortEvent");
      expect(prismaMock.shipment.findFirst).not.toHaveBeenCalled();
    });

    it("returns 400 when generic_carrier_v1 omits carrierPayload", async () => {
      const res = await processControlTowerInboundWebhook({
        tenantId,
        actorUserId,
        body: { payloadFormat: "generic_carrier_v1" },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("carrierPayload object required");
      expect(prismaMock.shipment.findFirst).not.toHaveBeenCalled();
    });

    it("returns 400 when tms_event_v1 has milestone but no shipment id on tmsPayload", async () => {
      const res = await processControlTowerInboundWebhook({
        tenantId,
        actorUserId,
        body: {
          payloadFormat: "tms_event_v1",
          tmsPayload: {
            milestoneCode: "X",
            actualAt: "2026-01-01T00:00:00.000Z",
          },
        },
      });
      expect(res.status).toBe(400);
      expect(String(res.body.error)).toContain("shipmentId");
      expect(prismaMock.shipment.findFirst).not.toHaveBeenCalled();
    });
  });
});
