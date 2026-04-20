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
