/**
 * BF-49 — merged tenant operations timeline (Control Tower audits + WMS ledger + dock milestones).
 */

import { Buffer } from "node:buffer";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const TIMELINE_LIMIT_DEFAULT = 40;
export const TIMELINE_LIMIT_MIN = 1;
export const TIMELINE_LIMIT_MAX = 100;

export const TIMELINE_SK_CT_AUDIT = 2;
export const TIMELINE_SK_INVENTORY_MOVEMENT = 1;
export const TIMELINE_SK_DOCK_MILESTONE = 0;

export const TIMELINE_SOURCE_KEYS = ["ct_audit", "inventory_movement", "dock_milestone"] as const;
export type TimelineSourceKey = (typeof TIMELINE_SOURCE_KEYS)[number];

export type OperationsTimelineEventKind = "ct_audit" | "inventory_movement" | "dock_milestone";

export type OperationsTimelineEvent = {
  id: string;
  kind: OperationsTimelineEventKind;
  occurredAt: string;
  title: string;
  detail: Record<string, unknown>;
};

type TimelineCursorPayloadV1 = { v: 1; t: string; sk: number; id: string };

const CURSOR_MAX_CHARS = 512;

export function clampTimelineLimit(raw: number): number {
  if (!Number.isFinite(raw)) return TIMELINE_LIMIT_DEFAULT;
  const n = Math.trunc(raw);
  return Math.min(TIMELINE_LIMIT_MAX, Math.max(TIMELINE_LIMIT_MIN, n));
}

export function parseTimelineSourcesParam(raw: string | null): Set<TimelineSourceKey> {
  const parts = raw
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts?.length) {
    return new Set(TIMELINE_SOURCE_KEYS);
  }
  const next = new Set<TimelineSourceKey>();
  for (const p of parts) {
    if ((TIMELINE_SOURCE_KEYS as readonly string[]).includes(p)) {
      next.add(p as TimelineSourceKey);
    }
  }
  return next.size ? next : new Set(TIMELINE_SOURCE_KEYS);
}

export function encodeOperationsTimelineCursor(row: { t: Date; sk: number; id: string }): string {
  const payload: TimelineCursorPayloadV1 = {
    v: 1,
    t: row.t.toISOString(),
    sk: row.sk,
    id: row.id,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeOperationsTimelineCursor(
  raw: string,
): { ok: true; t: Date; sk: number; id: string } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed.length) {
    return { ok: false, message: "cursor cannot be empty." };
  }
  if (trimmed.length > CURSOR_MAX_CHARS) {
    return { ok: false, message: "cursor is too large." };
  }
  try {
    const json = Buffer.from(trimmed, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<TimelineCursorPayloadV1>;
    if (parsed.v !== 1 || typeof parsed.t !== "string" || typeof parsed.sk !== "number" || typeof parsed.id !== "string") {
      return { ok: false, message: "cursor payload is invalid." };
    }
    const t = new Date(parsed.t);
    if (Number.isNaN(t.getTime())) {
      return { ok: false, message: "cursor timestamp is invalid." };
    }
    const sk = Math.trunc(parsed.sk);
    if (sk < TIMELINE_SK_DOCK_MILESTONE || sk > TIMELINE_SK_CT_AUDIT) {
      return { ok: false, message: "cursor sort key is invalid." };
    }
    if (!parsed.id.trim()) {
      return { ok: false, message: "cursor id is invalid." };
    }
    return { ok: true, t, sk, id: parsed.id };
  } catch {
    return { ok: false, message: "cursor could not be decoded." };
  }
}

function asDetailRecord(detail: unknown): Record<string, unknown> {
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    return detail as Record<string, unknown>;
  }
  return {};
}

export function mapRawTimelineRow(raw: {
  id: string;
  sk: number;
  t: Date;
  kind: string;
  title: string | null;
  detail: unknown;
}): OperationsTimelineEvent | null {
  const kind = raw.kind;
  if (kind !== "ct_audit" && kind !== "inventory_movement" && kind !== "dock_milestone") {
    return null;
  }
  return {
    id: raw.id,
    kind,
    occurredAt: raw.t.toISOString(),
    title: raw.title?.trim() || kind,
    detail: asDetailRecord(raw.detail),
  };
}

function joinUnionAll(parts: Prisma.Sql[]): Prisma.Sql {
  if (parts.length === 0) return Prisma.sql``;
  let acc = parts[0]!;
  for (let i = 1; i < parts.length; i++) {
    acc = Prisma.sql`${acc} UNION ALL ${parts[i]!}`;
  }
  return acc;
}

function timelineUnionFragments(params: { tenantId: string; sources: Set<TimelineSourceKey> }): Prisma.Sql[] {
  const { tenantId, sources } = params;
  const parts: Prisma.Sql[] = [];

  if (sources.has("ct_audit")) {
    parts.push(Prisma.sql`
      SELECT cal.id,
             ${TIMELINE_SK_CT_AUDIT}::int AS sk,
             cal."createdAt" AS t,
             'ct_audit'::text AS kind,
             cal.action AS title,
             jsonb_build_object(
               'entityType', cal."entityType",
               'entityId', cal."entityId",
               'shipmentId', cal."shipmentId",
               'actorEmail', u.email
             ) AS detail
      FROM "CtAuditLog" cal
      LEFT JOIN "User" u ON u.id = cal."actorUserId"
      WHERE cal."tenantId" = ${tenantId}
    `);
  }

  if (sources.has("inventory_movement")) {
    parts.push(Prisma.sql`
      SELECT im.id,
             ${TIMELINE_SK_INVENTORY_MOVEMENT}::int AS sk,
             im."createdAt" AS t,
             'inventory_movement'::text AS kind,
             concat(im."movementType"::text, ' · qty ', im.quantity::text) AS title,
             jsonb_build_object(
               'warehouseCode', wh.code,
               'productLabel', COALESCE(p.sku, p."productCode", p.name),
               'referenceType', im."referenceType",
               'referenceId', im."referenceId"
             ) AS detail
      FROM "InventoryMovement" im
      JOIN "Product" p ON p.id = im."productId"
      JOIN "Warehouse" wh ON wh.id = im."warehouseId"
      WHERE im."tenantId" = ${tenantId}
    `);
  }

  if (sources.has("dock_milestone")) {
    parts.push(Prisma.sql`
      SELECT concat(d.id, ':gate') AS id,
             ${TIMELINE_SK_DOCK_MILESTONE}::int AS sk,
             d."gateCheckedInAt" AS t,
             'dock_milestone'::text AS kind,
             concat('Gate check-in · ', d."dockCode") AS title,
             jsonb_build_object(
               'milestone', 'gate_in',
               'appointmentId', d.id,
               'warehouseCode', wh.code,
               'direction', d.direction::text,
               'carrierName', d."carrierName"
             ) AS detail
      FROM "WmsDockAppointment" d
      JOIN "Warehouse" wh ON wh.id = d."warehouseId"
      WHERE d."tenantId" = ${tenantId} AND d."gateCheckedInAt" IS NOT NULL
    `);
    parts.push(Prisma.sql`
      SELECT concat(d.id, ':dock') AS id,
             ${TIMELINE_SK_DOCK_MILESTONE}::int AS sk,
             d."atDockAt" AS t,
             'dock_milestone'::text AS kind,
             concat('At dock · ', d."dockCode") AS title,
             jsonb_build_object(
               'milestone', 'at_dock',
               'appointmentId', d.id,
               'warehouseCode', wh.code,
               'direction', d.direction::text,
               'carrierName', d."carrierName"
             ) AS detail
      FROM "WmsDockAppointment" d
      JOIN "Warehouse" wh ON wh.id = d."warehouseId"
      WHERE d."tenantId" = ${tenantId} AND d."atDockAt" IS NOT NULL
    `);
    parts.push(Prisma.sql`
      SELECT concat(d.id, ':dep') AS id,
             ${TIMELINE_SK_DOCK_MILESTONE}::int AS sk,
             d."departedAt" AS t,
             'dock_milestone'::text AS kind,
             concat('Departed · ', d."dockCode") AS title,
             jsonb_build_object(
               'milestone', 'departed',
               'appointmentId', d.id,
               'warehouseCode', wh.code,
               'direction', d.direction::text,
               'carrierName', d."carrierName"
             ) AS detail
      FROM "WmsDockAppointment" d
      JOIN "Warehouse" wh ON wh.id = d."warehouseId"
      WHERE d."tenantId" = ${tenantId} AND d."departedAt" IS NOT NULL
    `);
  }

  return parts;
}

export async function fetchTenantOperationsTimelinePage(params: {
  tenantId: string;
  limit: number;
  sources: Set<TimelineSourceKey>;
  cursor: { t: Date; sk: number; id: string } | null;
}): Promise<{ events: OperationsTimelineEvent[]; nextCursor: string | null }> {
  const { tenantId, limit, sources, cursor } = params;
  const parts = timelineUnionFragments({ tenantId, sources });
  if (!parts.length) {
    return { events: [], nextCursor: null };
  }

  const unionSql = joinUnionAll(parts);

  const cursorSql =
    cursor === null
      ? Prisma.sql``
      : Prisma.sql`WHERE (
          ("ev"."t" < ${cursor.t}) OR
          ("ev"."t" = ${cursor.t} AND "ev"."sk" < ${cursor.sk}) OR
          ("ev"."t" = ${cursor.t} AND "ev"."sk" = ${cursor.sk} AND "ev"."id" < ${cursor.id})
        )`;

  const rows = await prisma.$queryRaw<
    Array<{ id: string; sk: number; t: Date; kind: string; title: string | null; detail: unknown }>
  >(Prisma.sql`
    SELECT "ev".id, "ev".sk, "ev".t, "ev".kind, "ev".title, "ev".detail
    FROM (
      ${unionSql}
    ) AS "ev"
    ${cursorSql}
    ORDER BY "ev".t DESC, "ev".sk DESC, "ev".id DESC
    LIMIT ${limit}
  `);

  const events: OperationsTimelineEvent[] = [];
  for (const r of rows) {
    const ev = mapRawTimelineRow(r);
    if (ev) events.push(ev);
  }

  if (!events.length || rows.length < limit) {
    return { events, nextCursor: null };
  }

  const rawTail = rows[rows.length - 1];
  return {
    events,
    nextCursor: encodeOperationsTimelineCursor({ t: rawTail.t, sk: rawTail.sk, id: rawTail.id }),
  };
}