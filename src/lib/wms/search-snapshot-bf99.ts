import { Buffer } from "node:buffer";

import type { Prisma, PrismaClient } from "@prisma/client";

import type { WmsViewReadScope } from "@/lib/wms/wms-read-scope";

export const SEARCH_SNAPSHOT_BF99_SCHEMA_VERSION = "bf99.v1";
export const SEARCH_SNAPSHOT_BF99_CURSOR_MAX_CHARS = 768;
export const SEARCH_SNAPSHOT_BF99_LIMIT_DEFAULT = 200;
export const SEARCH_SNAPSHOT_BF99_LIMIT_MAX = 500;
export const SEARCH_SNAPSHOT_BF99_LIMIT_MIN = 1;

type CursorPayloadV1 = { v: 1; s: 0 | 1 | 2; a: string | null };

export type SearchSnapshotBf99CursorState = CursorPayloadV1;

export function encodeSearchSnapshotBf99Cursor(state: SearchSnapshotBf99CursorState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeSearchSnapshotBf99Cursor(
  raw: string | null | undefined,
): { ok: true; state: SearchSnapshotBf99CursorState } | { ok: false; message: string } {
  if (raw == null || raw.trim() === "") {
    return { ok: true, state: { v: 1, s: 0, a: null } };
  }
  const trimmed = raw.trim();
  if (trimmed.length > SEARCH_SNAPSHOT_BF99_CURSOR_MAX_CHARS) {
    return { ok: false, message: "cursor is too large." };
  }
  try {
    const json = Buffer.from(trimmed, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<CursorPayloadV1>;
    if (parsed.v !== 1 || ![0, 1, 2].includes(parsed.s as number)) {
      return { ok: false, message: "cursor payload is invalid." };
    }
    const s = parsed.s as 0 | 1 | 2;
    const a =
      parsed.a === null || parsed.a === undefined
        ? null
        : typeof parsed.a === "string"
          ? parsed.a.trim()
          : null;
    if (a !== null) {
      if (a.length < 12 || a.length > 36 || !/^[a-z0-9]+$/i.test(a)) {
        return { ok: false, message: "cursor afterId is invalid." };
      }
    }
    return { ok: true, state: { v: 1, s, a } };
  } catch {
    return { ok: false, message: "cursor could not be decoded." };
  }
}

export function parseSearchSnapshotBf99Limit(raw: string | null | undefined): number {
  if (!raw?.trim()) return SEARCH_SNAPSHOT_BF99_LIMIT_DEFAULT;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n)) return SEARCH_SNAPSHOT_BF99_LIMIT_DEFAULT;
  return Math.min(SEARCH_SNAPSHOT_BF99_LIMIT_MAX, Math.max(SEARCH_SNAPSHOT_BF99_LIMIT_MIN, n));
}

/** Advance to the next entity segment after the current one is exhausted. */
function segmentAfter(
  current: 0 | 1 | 2,
): { v: 1; s: 0 | 1 | 2; a: null } | null {
  if (current >= 2) return null;
  return { v: 1, s: (current + 1) as 0 | 1 | 2, a: null };
}

type ShipmentRow = {
  id: string;
  orderId: string;
  salesOrderId: string | null;
  shipmentNo: string | null;
  status: string;
  trackingNo: string | null;
  carrier: string | null;
  asnReference: string | null;
  wmsReceiveStatus: string;
  updatedAt: Date;
};

type OutboundRow = {
  id: string;
  outboundNo: string;
  customerRef: string | null;
  asnReference: string | null;
  status: string;
  warehouseId: string;
  crmAccountId: string | null;
  requestedShipDate: Date | null;
  updatedAt: Date;
};

type TaskRow = {
  id: string;
  warehouseId: string;
  taskType: string;
  status: string;
  shipmentId: string | null;
  orderId: string | null;
  waveId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  quantity: { toString(): string };
  updatedAt: Date;
};

function mapShipment(tenantSlug: string, row: ShipmentRow): Record<string, unknown> {
  return {
    schemaVersion: SEARCH_SNAPSHOT_BF99_SCHEMA_VERSION,
    entityType: "shipment",
    tenantSlug,
    id: row.id,
    orderId: row.orderId,
    salesOrderId: row.salesOrderId,
    shipmentNo: row.shipmentNo,
    status: row.status,
    trackingNo: row.trackingNo,
    carrier: row.carrier,
    asnReference: row.asnReference,
    wmsReceiveStatus: row.wmsReceiveStatus,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapOutbound(tenantSlug: string, row: OutboundRow): Record<string, unknown> {
  return {
    schemaVersion: SEARCH_SNAPSHOT_BF99_SCHEMA_VERSION,
    entityType: "outbound_order",
    tenantSlug,
    id: row.id,
    outboundNo: row.outboundNo,
    customerRef: row.customerRef,
    asnReference: row.asnReference,
    status: row.status,
    warehouseId: row.warehouseId,
    crmAccountId: row.crmAccountId,
    requestedShipDate: row.requestedShipDate ? row.requestedShipDate.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapTask(tenantSlug: string, row: TaskRow): Record<string, unknown> {
  return {
    schemaVersion: SEARCH_SNAPSHOT_BF99_SCHEMA_VERSION,
    entityType: "wms_task",
    tenantSlug,
    id: row.id,
    warehouseId: row.warehouseId,
    taskType: row.taskType,
    status: row.status,
    shipmentId: row.shipmentId,
    orderId: row.orderId,
    waveId: row.waveId,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    quantity: row.quantity.toString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function fetchShipmentChunk(
  prisma: PrismaClient,
  tenantId: string,
  viewScope: WmsViewReadScope,
  afterId: string | null,
  take: number,
): Promise<ShipmentRow[]> {
  const base: Prisma.ShipmentWhereInput = {
    AND: [{ order: { tenantId } }, viewScope.shipment],
  };
  const where: Prisma.ShipmentWhereInput =
    afterId === null ? base : { AND: [base, { id: { gt: afterId } }] };
  const rows = await prisma.shipment.findMany({
    where,
    orderBy: { id: "asc" },
    take,
    select: {
      id: true,
      orderId: true,
      salesOrderId: true,
      shipmentNo: true,
      status: true,
      trackingNo: true,
      carrier: true,
      asnReference: true,
      wmsReceiveStatus: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    status: String(r.status),
    wmsReceiveStatus: String(r.wmsReceiveStatus),
  }));
}

async function fetchOutboundChunk(
  prisma: PrismaClient,
  tenantId: string,
  viewScope: WmsViewReadScope,
  afterId: string | null,
  take: number,
): Promise<OutboundRow[]> {
  const base: Prisma.OutboundOrderWhereInput = {
    AND: [{ tenantId }, viewScope.outboundOrder],
  };
  const where: Prisma.OutboundOrderWhereInput =
    afterId === null ? base : { AND: [base, { id: { gt: afterId } }] };
  const rows = await prisma.outboundOrder.findMany({
    where,
    orderBy: { id: "asc" },
    take,
    select: {
      id: true,
      outboundNo: true,
      customerRef: true,
      asnReference: true,
      status: true,
      warehouseId: true,
      crmAccountId: true,
      requestedShipDate: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => ({ ...r, status: String(r.status) }));
}

async function fetchTaskChunk(
  prisma: PrismaClient,
  tenantId: string,
  viewScope: WmsViewReadScope,
  afterId: string | null,
  take: number,
): Promise<TaskRow[]> {
  const base: Prisma.WmsTaskWhereInput = {
    AND: [{ tenantId }, viewScope.wmsTask],
  };
  const where: Prisma.WmsTaskWhereInput =
    afterId === null ? base : { AND: [base, { id: { gt: afterId } }] };
  const rows = await prisma.wmsTask.findMany({
    where,
    orderBy: { id: "asc" },
    take,
    select: {
      id: true,
      warehouseId: true,
      taskType: true,
      status: true,
      shipmentId: true,
      orderId: true,
      waveId: true,
      referenceType: true,
      referenceId: true,
      quantity: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    taskType: String(r.taskType),
    status: String(r.status),
  }));
}

async function fetchChunk(
  prisma: PrismaClient,
  tenantId: string,
  viewScope: WmsViewReadScope,
  seg: 0 | 1 | 2,
  afterId: string | null,
  take: number,
): Promise<ShipmentRow[] | OutboundRow[] | TaskRow[]> {
  switch (seg) {
    case 0:
      return fetchShipmentChunk(prisma, tenantId, viewScope, afterId, take);
    case 1:
      return fetchOutboundChunk(prisma, tenantId, viewScope, afterId, take);
    case 2:
      return fetchTaskChunk(prisma, tenantId, viewScope, afterId, take);
    default:
      return [];
  }
}

function mapRow(
  tenantSlug: string,
  seg: 0 | 1 | 2,
  row: ShipmentRow | OutboundRow | TaskRow,
): Record<string, unknown> {
  if (seg === 0) return mapShipment(tenantSlug, row as ShipmentRow);
  if (seg === 1) return mapOutbound(tenantSlug, row as OutboundRow);
  return mapTask(tenantSlug, row as TaskRow);
}

/**
 * BF-99 — paginated JSON Lines payload (each row is one NDJSON record). Cursor advances shipments → outbound orders → tasks.
 */
export async function loadSearchSnapshotBf99Ndjson(
  prisma: PrismaClient,
  tenantId: string,
  tenantSlug: string,
  viewScope: WmsViewReadScope,
  opts: { cursorRaw: string | null | undefined; limit: number },
): Promise<{ body: string; nextCursor: string | null; lineCount: number }> {
  const decoded = decodeSearchSnapshotBf99Cursor(opts.cursorRaw);
  if (!decoded.ok) {
    throw new Error(decoded.message);
  }
  let state = decoded.state;
  const limit = opts.limit;
  const records: Record<string, unknown>[] = [];

  while (records.length < limit) {
    const seg = state.s;
    const need = limit - records.length;
    const rows = await fetchChunk(prisma, tenantId, viewScope, seg, state.a, need + 1);

    if (rows.length === 0) {
      const next = segmentAfter(seg);
      if (!next) break;
      state = next;
      continue;
    }

    if (rows.length > need) {
      const slice = rows.slice(0, need) as (ShipmentRow | OutboundRow | TaskRow)[];
      for (const row of slice) {
        records.push(mapRow(tenantSlug, seg, row));
      }
      const last = slice[slice.length - 1]!;
      return {
        body: records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : ""),
        nextCursor: encodeSearchSnapshotBf99Cursor({ v: 1, s: seg, a: last.id }),
        lineCount: records.length,
      };
    }

    for (const row of rows) {
      records.push(mapRow(tenantSlug, seg, row as ShipmentRow | OutboundRow | TaskRow));
    }

    const nextSeg = segmentAfter(seg);
    if (!nextSeg) break;
    state = nextSeg;
  }

  return {
    body: records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : ""),
    nextCursor: null,
    lineCount: records.length,
  };
}
