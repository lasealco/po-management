/**
 * BF-60 — batch replay of offline pack/ship scan validations with idempotent clientBatchId.
 */

import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { validateOutboundLuHierarchy } from "./outbound-lu-hierarchy";
import {
  fetchParsedRfidEncodingBf81ForTenant,
  type ParsedRfidEncodingTableBf81,
} from "./rfid-scan-bridge-bf81";
import {
  buildOutboundPackScanPlan,
  flattenPackScanExpectations,
  parsePackScanTokenArray,
} from "./pack-scan-verify";
import { verifyOutboundPackScanResolved } from "./outbound-logistics-unit-scan";

export const SCAN_EVENT_BATCH_TYPES = ["VALIDATE_PACK_SCAN", "VALIDATE_SHIP_SCAN"] as const;
export type ScanEventBatchType = (typeof SCAN_EVENT_BATCH_TYPES)[number];

export type ParsedScanEventBatch = {
  clientBatchId: string;
  deviceClock: string;
  events: Array<{
    seq: number;
    deviceClock: string;
    type: ScanEventBatchType;
    payload: {
      outboundOrderId: string;
      packScanTokens?: string[];
      shipScanTokens?: string[];
    };
  }>;
};

const MAX_EVENTS = 50;

function isScanEventType(x: string): x is ScanEventBatchType {
  return (SCAN_EVENT_BATCH_TYPES as readonly string[]).includes(x);
}

export function parseScanEventBatchPayload(input: unknown):
  | { ok: true; value: ParsedScanEventBatch }
  | { ok: false; error: string } {
  if (input === null || typeof input !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const o = input as Record<string, unknown>;
  const clientBatchId = typeof o.clientBatchId === "string" ? o.clientBatchId.trim() : "";
  const deviceClock = typeof o.deviceClock === "string" ? o.deviceClock.trim() : "";
  if (!clientBatchId || clientBatchId.length > 128) {
    return { ok: false, error: "clientBatchId required (non-empty, max 128 chars)." };
  }
  if (!deviceClock || deviceClock.length > 64) {
    return { ok: false, error: "deviceClock required (non-empty ISO-8601 string, max 64 chars)." };
  }
  if (!Array.isArray(o.events)) {
    return { ok: false, error: "events must be an array." };
  }
  if (o.events.length === 0) {
    return { ok: false, error: "events must be non-empty." };
  }
  if (o.events.length > MAX_EVENTS) {
    return { ok: false, error: `events max ${MAX_EVENTS} per batch.` };
  }

  const events: ParsedScanEventBatch["events"] = [];
  for (let i = 0; i < o.events.length; i += 1) {
    const row = o.events[i];
    if (row === null || typeof row !== "object") {
      return { ok: false, error: `events[${i}] must be an object.` };
    }
    const er = row as Record<string, unknown>;
    const seq = typeof er.seq === "number" && Number.isInteger(er.seq) ? er.seq : NaN;
    const evClock = typeof er.deviceClock === "string" ? er.deviceClock.trim() : "";
    const typeRaw = typeof er.type === "string" ? er.type.trim() : "";
    if (!Number.isFinite(seq) || seq < 1) {
      return { ok: false, error: `events[${i}].seq must be a positive integer.` };
    }
    if (!evClock || evClock.length > 64) {
      return { ok: false, error: `events[${i}].deviceClock invalid.` };
    }
    if (!isScanEventType(typeRaw)) {
      return { ok: false, error: `events[${i}].type must be VALIDATE_PACK_SCAN or VALIDATE_SHIP_SCAN.` };
    }
    const pl = er.payload;
    if (pl === null || typeof pl !== "object") {
      return { ok: false, error: `events[${i}].payload must be an object.` };
    }
    const p = pl as Record<string, unknown>;
    const outboundOrderId = typeof p.outboundOrderId === "string" ? p.outboundOrderId.trim() : "";
    if (!outboundOrderId) {
      return { ok: false, error: `events[${i}].payload.outboundOrderId required.` };
    }
    const packScanTokens =
      typeRaw === "VALIDATE_PACK_SCAN" ? parsePackScanTokenArray(p.packScanTokens) : undefined;
    const shipScanTokens =
      typeRaw === "VALIDATE_SHIP_SCAN" ? parsePackScanTokenArray(p.shipScanTokens) : undefined;

    if (typeRaw === "VALIDATE_PACK_SCAN" && p.packScanTokens !== undefined && !Array.isArray(p.packScanTokens)) {
      return { ok: false, error: `events[${i}].payload.packScanTokens must be an array when set.` };
    }
    if (typeRaw === "VALIDATE_SHIP_SCAN" && p.shipScanTokens !== undefined && !Array.isArray(p.shipScanTokens)) {
      return { ok: false, error: `events[${i}].payload.shipScanTokens must be an array when set.` };
    }

    events.push({
      seq,
      deviceClock: evClock,
      type: typeRaw,
      payload: {
        outboundOrderId,
        ...(packScanTokens !== undefined ? { packScanTokens } : {}),
        ...(shipScanTokens !== undefined ? { shipScanTokens } : {}),
      },
    });
  }

  events.sort((a, b) => a.seq - b.seq);
  for (let i = 0; i < events.length; i += 1) {
    if (events[i].seq !== i + 1) {
      return { ok: false, error: "events.seq must be contiguous starting at 1." };
    }
  }

  return { ok: true, value: { clientBatchId, deviceClock, events } };
}

export type ScanBatchConflictBody = {
  ok: false;
  code: "SCAN_BATCH_CONFLICT";
  batchId?: string;
  failedAtSeq: number;
  conflict: {
    kind:
      | "ORDER_NOT_FOUND"
      | "ORDER_STATE_MISMATCH"
      | "SCAN_VALIDATION_FAILED"
      | "LOGISTICS_UNIT_VALIDATION_FAILED"
      | "SHIP_NOT_FULLY_PACKED"
      | "SHIP_SCAN_REQUIRED_EMPTY";
    message: string;
    outboundOrderId: string;
    orderStatus?: string;
    missing?: string[];
    unexpected?: string[];
    luErrors?: string[];
  };
};

export type ScanBatchSuccessBody = {
  ok: true;
  batchId: string;
  clientBatchId: string;
  results: Array<{
    seq: number;
    type: ScanEventBatchType;
    ok: true;
    validate: {
      ok: boolean;
      missing: string[];
      unexpected: string[];
      plan: ReturnType<typeof buildOutboundPackScanPlan>;
      expectedTotal: number;
      scannedTotal: number;
    };
  }>;
};

export type ScanBatchResponseBody = ScanBatchSuccessBody | ScanBatchConflictBody;

type HandleResult = { status: number; body: ScanBatchResponseBody };

async function loadOrderForPackScan(tenantId: string, outboundOrderId: string) {
  return prisma.outboundOrder.findFirst({
    where: { id: outboundOrderId, tenantId },
    include: { lines: { include: { product: true } } },
  });
}

async function runValidatePackScan(
  tenantId: string,
  outboundOrderId: string,
  tokens: string[],
  rfidEncoding: ParsedRfidEncodingTableBf81,
): Promise<
  | { ok: true; validate: ScanBatchSuccessBody["results"][0]["validate"] }
  | { ok: false; conflict: ScanBatchConflictBody["conflict"] }
> {
  const order = await loadOrderForPackScan(tenantId, outboundOrderId);
  if (!order) {
    return {
      ok: false,
      conflict: {
        kind: "ORDER_NOT_FOUND",
        message: "Outbound order not found.",
        outboundOrderId,
      },
    };
  }
  if (
    order.status !== "RELEASED" &&
    order.status !== "PICKING" &&
    order.status !== "PACKED"
  ) {
    return {
      ok: false,
      conflict: {
        kind: "ORDER_STATE_MISMATCH",
        message:
          "Pack scan validation applies when the order is RELEASED, PICKING, or PACKED.",
        outboundOrderId,
        orderStatus: order.status,
      },
    };
  }
  const plan =
    order.status === "PACKED"
      ? buildOutboundPackScanPlan(
          order.lines.map((l) => ({ pickedQty: Number(l.packedQty), product: l.product })),
        )
      : buildOutboundPackScanPlan(
          order.lines.map((l) => ({ pickedQty: Number(l.pickedQty), product: l.product })),
        );
  const flat = flattenPackScanExpectations(plan);
  const result = await verifyOutboundPackScanResolved(tenantId, outboundOrderId, flat, tokens, rfidEncoding);
  if (!result.ok) {
    return {
      ok: false,
      conflict: {
        kind: "SCAN_VALIDATION_FAILED",
        message: "Pack scan multiset does not match expected picks/packed units.",
        outboundOrderId,
        orderStatus: order.status,
        missing: result.missing,
        unexpected: result.unexpected,
      },
    };
  }
  return {
    ok: true,
    validate: {
      ok: true,
      missing: result.missing,
      unexpected: result.unexpected,
      plan,
      expectedTotal: flat.length,
      scannedTotal: tokens.length,
    },
  };
}

async function runValidateShipScan(
  tenantId: string,
  outboundOrderId: string,
  tokens: string[],
  rfidEncoding: ParsedRfidEncodingTableBf81,
): Promise<
  | { ok: true; validate: ScanBatchSuccessBody["results"][0]["validate"] }
  | { ok: false; conflict: ScanBatchConflictBody["conflict"] }
> {
  const order = await loadOrderForPackScan(tenantId, outboundOrderId);
  if (!order) {
    return {
      ok: false,
      conflict: {
        kind: "ORDER_NOT_FOUND",
        message: "Outbound order not found.",
        outboundOrderId,
      },
    };
  }
  if (order.status !== "PACKED") {
    return {
      ok: false,
      conflict: {
        kind: "ORDER_STATE_MISMATCH",
        message: "Ship scan validation requires the order to be PACKED.",
        outboundOrderId,
        orderStatus: order.status,
      },
    };
  }
  const allPacked = order.lines.every((l) => Number(l.packedQty) >= Number(l.quantity));
  if (!allPacked) {
    return {
      ok: false,
      conflict: {
        kind: "SHIP_NOT_FULLY_PACKED",
        message: "All lines must be fully packed before ship scan validation.",
        outboundOrderId,
        orderStatus: order.status,
      },
    };
  }

  const enforceSscc = process.env.WMS_ENFORCE_SSCC === "1";
  if (enforceSscc) {
    const luRows = await prisma.wmsOutboundLogisticsUnit.findMany({
      where: { tenantId, outboundOrderId },
      select: {
        id: true,
        parentUnitId: true,
        scanCode: true,
        outboundOrderLineId: true,
        containedQty: true,
      },
    });
    if (luRows.length > 0) {
      const v = validateOutboundLuHierarchy(
        luRows.map((r) => ({
          id: r.id,
          parentUnitId: r.parentUnitId,
          scanCode: r.scanCode,
          outboundOrderLineId: r.outboundOrderLineId,
          containedQty: r.containedQty != null ? r.containedQty.toString() : null,
        })),
      );
      if (!v.ok) {
        return {
          ok: false,
          conflict: {
            kind: "LOGISTICS_UNIT_VALIDATION_FAILED",
            message: `WMS_ENFORCE_SSCC=1: ${v.errors.slice(0, 6).join("; ")}`,
            outboundOrderId,
            orderStatus: order.status,
            luErrors: v.errors,
          },
        };
      }
    }
  }

  const requireShipScan = process.env.WMS_REQUIRE_SHIP_SCAN === "1";
  if (requireShipScan && tokens.length === 0) {
    return {
      ok: false,
      conflict: {
        kind: "SHIP_SCAN_REQUIRED_EMPTY",
        message: "shipScanTokens required when WMS_REQUIRE_SHIP_SCAN=1.",
        outboundOrderId,
        orderStatus: order.status,
      },
    };
  }

  const plan = buildOutboundPackScanPlan(
    order.lines.map((l) => ({ pickedQty: Number(l.packedQty), product: l.product })),
  );
  const flat = flattenPackScanExpectations(plan);
  if (tokens.length > 0) {
    const shipScanResult = await verifyOutboundPackScanResolved(tenantId, outboundOrderId, flat, tokens, rfidEncoding);
    if (!shipScanResult.ok) {
      return {
        ok: false,
        conflict: {
          kind: "SCAN_VALIDATION_FAILED",
          message: "Ship scan multiset does not match packed units.",
          outboundOrderId,
          orderStatus: order.status,
          missing: shipScanResult.missing,
          unexpected: shipScanResult.unexpected,
        },
      };
    }
    return {
      ok: true,
      validate: {
        ok: true,
        missing: shipScanResult.missing,
        unexpected: shipScanResult.unexpected,
        plan,
        expectedTotal: flat.length,
        scannedTotal: tokens.length,
      },
    };
  }

  return {
    ok: true,
    validate: {
      ok: true,
      missing: [],
      unexpected: [],
      plan,
      expectedTotal: flat.length,
      scannedTotal: 0,
    },
  };
}

async function readCachedBatch(tenantId: string, clientBatchId: string): Promise<HandleResult | null> {
  const existing = await prisma.wmsScanEventBatch.findUnique({
    where: { tenantId_clientBatchId: { tenantId, clientBatchId } },
  });
  if (!existing) return null;
  return {
    status: existing.lastStatusCode,
    body: existing.lastResponseJson as ScanBatchResponseBody,
  };
}

export async function executeScanEventBatch(
  tenantId: string,
  actorId: string,
  input: ParsedScanEventBatch,
): Promise<HandleResult> {
  const cached = await readCachedBatch(tenantId, input.clientBatchId);
  if (cached) return cached;

  const rfidEncoding = await fetchParsedRfidEncodingBf81ForTenant(tenantId);

  const results: ScanBatchSuccessBody["results"] = [];

  for (const ev of input.events) {
    if (ev.type === "VALIDATE_PACK_SCAN") {
      const tokens = ev.payload.packScanTokens ?? [];
      const r = await runValidatePackScan(tenantId, ev.payload.outboundOrderId, tokens, rfidEncoding);
      if (!r.ok) {
        const conflictBody: ScanBatchConflictBody = {
          ok: false,
          code: "SCAN_BATCH_CONFLICT",
          failedAtSeq: ev.seq,
          conflict: r.conflict,
        };
        const batchId = randomUUID();
        const withId: ScanBatchConflictBody = { ...conflictBody, batchId };
        try {
          await prisma.wmsScanEventBatch.create({
            data: {
              id: batchId,
              tenantId,
              clientBatchId: input.clientBatchId,
              deviceClock: input.deviceClock,
              createdById: actorId,
              lastStatusCode: 409,
              lastResponseJson: withId as object,
            },
          });
          return { status: 409, body: withId };
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            const retry = await readCachedBatch(tenantId, input.clientBatchId);
            if (retry) return retry;
          }
          throw e;
        }
      }
      results.push({
        seq: ev.seq,
        type: ev.type,
        ok: true,
        validate: r.validate,
      });
    } else {
      const tokens = ev.payload.shipScanTokens ?? [];
      const r = await runValidateShipScan(tenantId, ev.payload.outboundOrderId, tokens, rfidEncoding);
      if (!r.ok) {
        const conflictBody: ScanBatchConflictBody = {
          ok: false,
          code: "SCAN_BATCH_CONFLICT",
          failedAtSeq: ev.seq,
          conflict: r.conflict,
        };
        const batchId = randomUUID();
        const withId: ScanBatchConflictBody = { ...conflictBody, batchId };
        try {
          await prisma.wmsScanEventBatch.create({
            data: {
              id: batchId,
              tenantId,
              clientBatchId: input.clientBatchId,
              deviceClock: input.deviceClock,
              createdById: actorId,
              lastStatusCode: 409,
              lastResponseJson: withId as object,
            },
          });
          return { status: 409, body: withId };
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            const retry = await readCachedBatch(tenantId, input.clientBatchId);
            if (retry) return retry;
          }
          throw e;
        }
      }
      results.push({
        seq: ev.seq,
        type: ev.type,
        ok: true,
        validate: r.validate,
      });
    }
  }

  const batchId = randomUUID();
  const finalBody: ScanBatchSuccessBody = {
    ok: true,
    batchId,
    clientBatchId: input.clientBatchId,
    results,
  };
  try {
    await prisma.wmsScanEventBatch.create({
      data: {
        id: batchId,
        tenantId,
        clientBatchId: input.clientBatchId,
        deviceClock: input.deviceClock,
        createdById: actorId,
        lastStatusCode: 200,
        lastResponseJson: finalBody as object,
      },
    });
    return { status: 200, body: finalBody };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const retry = await readCachedBatch(tenantId, input.clientBatchId);
      if (retry) return retry;
    }
    throw e;
  }
}
