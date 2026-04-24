import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { writeCtAudit } from "@/lib/control-tower/audit";
import {
  mapSeaPortTrackEventToGenericCarrierPayload,
  mapSimpleCarrierEventV1ToGenericCarrierPayload,
  SEA_PORT_TRACK_V1_FORMAT,
  SIMPLE_CARRIER_EVENT_V1_FORMAT,
} from "@/lib/control-tower/inbound-carrier-mappers";
import { prisma } from "@/lib/prisma";

export type InboundWebhookHttpResult = { status: number; body: Record<string, unknown> };

const MAX_IDEM = 200;
/** Default max `data[]` rows for `carrier_webhook_v1` in one POST (abuse guard). */
const DEFAULT_CARRIER_WEBHOOK_ROWS = 50;
/** Hard ceiling even when {@link CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS} is set. */
const ABSOLUTE_MAX_CARRIER_WEBHOOK_ROWS = 200;

/**
 * Max rows per `carrier_webhook_v1` POST. Override with env `CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS`
 * (integer 1…{@link ABSOLUTE_MAX_CARRIER_WEBHOOK_ROWS}); invalid or empty → default {@link DEFAULT_CARRIER_WEBHOOK_ROWS}.
 */
function getMaxCarrierWebhookRows(): number {
  const raw = process.env.CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS?.trim();
  if (!raw) return DEFAULT_CARRIER_WEBHOOK_ROWS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_CARRIER_WEBHOOK_ROWS;
  const floored = Math.floor(n);
  if (floored < 1) return DEFAULT_CARRIER_WEBHOOK_ROWS;
  return Math.min(ABSOLUTE_MAX_CARRIER_WEBHOOK_ROWS, floored);
}
const MAX_CODE = 80;
const CODE_RE = /^[A-Za-z0-9._-]+$/;

function hashIdempotencyEntityId(tenantId: string, key: string): string {
  const h = createHash("sha256").update(`${tenantId}:${key}`, "utf8").digest("base64url");
  return `idem_${h.slice(0, 48)}`;
}

function parseIsoDate(v: unknown): Date | null | "invalid" {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v.trim());
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

function sanitizeMilestoneCode(raw: string): string | null {
  const t = raw.trim().slice(0, MAX_CODE);
  if (!t || !CODE_RE.test(t)) return null;
  return t;
}

async function assertShipmentTenant(shipmentId: string, tenantId: string): Promise<boolean> {
  const row = await prisma.shipment.findFirst({
    where: { id: shipmentId, order: { tenantId } },
    select: { id: true },
  });
  return Boolean(row);
}

type NormalizedInbound = {
  event: string;
  shipmentId: string;
  note: string;
  milestone: {
    code: string;
    actualAt: Date | null;
    plannedAt: Date | null;
    predictedAt: Date | null;
    label: string | null;
    notes: string | null;
    sourceRef: string | null;
  } | null;
};

type CarrierWebhookRowMilestone = NonNullable<NormalizedInbound["milestone"]>;

/** One `data[]` element for `carrier_webhook_v1` (same field shapes as `generic_carrier_v1` carrierPayload). */
function parseCarrierWebhookDataRow(
  o: Record<string, unknown>,
  fallbackBodyNote: string,
): { ok: false; error: string } | { ok: true; shipmentId: string; milestone: CarrierWebhookRowMilestone } {
  const shipmentId =
    (typeof o.shipment_id === "string" ? o.shipment_id.trim() : "") ||
    (typeof o.shipmentId === "string" ? o.shipmentId.trim() : "");
  const codeRaw =
    (typeof o.event_code === "string" ? o.event_code : "") || (typeof o.eventCode === "string" ? o.eventCode : "");
  const eventCode = sanitizeMilestoneCode(codeRaw);
  const eventTime = parseIsoDate(o.event_time ?? o.eventTime ?? o.occurred_at ?? o.occurredAt);
  if (eventTime === "invalid") return { ok: false, error: "invalid timestamp" };
  if (!shipmentId) return { ok: false, error: "shipment_id or shipmentId required" };
  if (!eventCode) return { ok: false, error: "event_code or eventCode required (alphanumeric / ._-)" };
  if (eventTime == null) {
    return { ok: false, error: "timestamp required (event_time | eventTime | occurred_at | occurredAt)" };
  }
  const rowNote =
    (typeof o.message === "string" ? o.message.trim().slice(0, 4000) : "") ||
    (fallbackBodyNote ? fallbackBodyNote : "");
  const ext =
    (typeof o.external_ref === "string" ? o.external_ref.trim().slice(0, 240) : "") ||
    (typeof o.externalRef === "string" ? o.externalRef.trim().slice(0, 240) : "");
  return {
    ok: true,
    shipmentId,
    milestone: {
      code: eventCode,
      actualAt: eventTime,
      plannedAt: null,
      predictedAt: null,
      label: null,
      notes: rowNote || null,
      sourceRef: ext || null,
    },
  };
}

function normalizeInboundBody(body: Record<string, unknown>): { ok: true; data: NormalizedInbound } | { ok: false; error: string } {
  const format =
    typeof body.payloadFormat === "string" && body.payloadFormat.trim()
      ? body.payloadFormat.trim()
      : "canonical";

  if (format === "canonical") {
    const event =
      typeof body.event === "string" && body.event.trim()
        ? body.event.trim().slice(0, 120)
        : "inbound_webhook";
    const shipmentId = typeof body.shipmentId === "string" ? body.shipmentId.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
    let milestone: NormalizedInbound["milestone"] = null;
    const m = body.milestone;
    if (m && typeof m === "object" && !Array.isArray(m)) {
      const mo = m as Record<string, unknown>;
      const code = typeof mo.code === "string" ? sanitizeMilestoneCode(mo.code) : null;
      if (!code) return { ok: false, error: "milestone.code is required and must be alphanumeric / ._-" };
      const actualAt = parseIsoDate(mo.actualAt);
      const plannedAt = parseIsoDate(mo.plannedAt);
      const predictedAt = parseIsoDate(mo.predictedAt);
      if (actualAt === "invalid" || plannedAt === "invalid" || predictedAt === "invalid") {
        return { ok: false, error: "Invalid ISO date in milestone" };
      }
      const label = typeof mo.label === "string" ? mo.label.trim().slice(0, 240) || null : null;
      const notes = typeof mo.notes === "string" ? mo.notes.trim().slice(0, 4000) || null : null;
      const sourceRef = typeof mo.sourceRef === "string" ? mo.sourceRef.trim().slice(0, 240) || null : null;
      milestone = { code, actualAt, plannedAt, predictedAt, label, notes, sourceRef };
    }
    return { ok: true, data: { event, shipmentId, note, milestone } };
  }

  if (format === SEA_PORT_TRACK_V1_FORMAT) {
    const sp = body.seaPortEvent;
    if (!sp || typeof sp !== "object" || Array.isArray(sp)) {
      return { ok: false, error: `seaPortEvent object required for ${SEA_PORT_TRACK_V1_FORMAT}` };
    }
    const mapped = mapSeaPortTrackEventToGenericCarrierPayload(sp as Record<string, unknown>);
    if (!mapped.ok) return { ok: false, error: mapped.error };
    return normalizeInboundBody({
      ...body,
      payloadFormat: "generic_carrier_v1",
      carrierPayload: mapped.carrierPayload,
    });
  }

  if (format === SIMPLE_CARRIER_EVENT_V1_FORMAT) {
    const mapped = mapSimpleCarrierEventV1ToGenericCarrierPayload(body);
    if (!mapped.ok) return { ok: false, error: mapped.error };
    return normalizeInboundBody({
      ...body,
      payloadFormat: "generic_carrier_v1",
      carrierPayload: mapped.carrierPayload,
    });
  }

  if (format === "generic_carrier_v1") {
    const cp = body.carrierPayload;
    if (!cp || typeof cp !== "object" || Array.isArray(cp)) {
      return { ok: false, error: "carrierPayload object required for generic_carrier_v1" };
    }
    const o = cp as Record<string, unknown>;
    const shipmentId = typeof o.shipment_id === "string" ? o.shipment_id.trim() : "";
    const eventCode = typeof o.event_code === "string" ? sanitizeMilestoneCode(o.event_code) : null;
    const eventTime = parseIsoDate(o.event_time);
    if (eventTime === "invalid") return { ok: false, error: "Invalid event_time" };
    if (!shipmentId) return { ok: false, error: "carrierPayload.shipment_id required" };
    if (!eventCode) return { ok: false, error: "carrierPayload.event_code required (alphanumeric / ._-)" };
    const note =
      typeof o.message === "string"
        ? o.message.trim().slice(0, 4000)
        : typeof body.note === "string"
          ? body.note.trim().slice(0, 4000)
          : "";
    const event =
      typeof body.event === "string" && body.event.trim()
        ? body.event.trim().slice(0, 120)
        : "generic_carrier_v1";
    return {
      ok: true,
      data: {
        event,
        shipmentId,
        note,
        milestone: {
          code: eventCode,
          actualAt: eventTime,
          plannedAt: null,
          predictedAt: null,
          label: null,
          notes: note || null,
          sourceRef: typeof o.external_ref === "string" ? o.external_ref.trim().slice(0, 240) || null : null,
        },
      },
    };
  }

  /** TMS-style JSON: `tmsPayload` with camelCase or snake_case aliases (see inbound route JSDoc). */
  if (format === "tms_event_v1") {
    const tp = body.tmsPayload;
    if (!tp || typeof tp !== "object" || Array.isArray(tp)) {
      return { ok: false, error: "tmsPayload object required for tms_event_v1" };
    }
    const o = tp as Record<string, unknown>;
    const shipmentId =
      (typeof o.shipmentId === "string" ? o.shipmentId.trim() : "") ||
      (typeof o.shipment_id === "string" ? o.shipment_id.trim() : "");
    const codeRaw =
      (typeof o.milestoneCode === "string" ? o.milestoneCode : "") ||
      (typeof o.milestone_code === "string" ? o.milestone_code : "") ||
      (typeof o.eventType === "string" ? o.eventType : "") ||
      (typeof o.event_type === "string" ? o.event_type : "");
    const milestoneCode = sanitizeMilestoneCode(codeRaw);
    const tsRaw = o.actualAt ?? o.actual_at ?? o.eventTimestamp ?? o.event_timestamp ?? o.occurredAt ?? o.occurred_at;
    const actualAt = parseIsoDate(tsRaw);
    const plannedAt = parseIsoDate(o.plannedAt ?? o.planned_at);
    const predictedAt = parseIsoDate(o.predictedAt ?? o.predicted_at);
    if (actualAt === "invalid" || plannedAt === "invalid" || predictedAt === "invalid") {
      return { ok: false, error: "Invalid ISO date in tms_event_v1 payload" };
    }
    if (!shipmentId) return { ok: false, error: "tmsPayload.shipmentId or shipment_id required" };
    if (!milestoneCode) {
      return {
        ok: false,
        error: "tmsPayload milestone code required (milestoneCode | milestone_code | eventType | event_type)",
      };
    }
    if (actualAt == null) {
      return {
        ok: false,
        error: "tmsPayload timestamp required (actualAt | actual_at | eventTimestamp | occurredAt, etc.)",
      };
    }
    const sourceRefRaw =
      (typeof o.correlationId === "string" ? o.correlationId.trim() : "") ||
      (typeof o.correlation_id === "string" ? o.correlation_id.trim() : "") ||
      (typeof o.transactionId === "string" ? o.transactionId.trim() : "") ||
      (typeof o.transaction_id === "string" ? o.transaction_id.trim() : "");
    const sourceRef = sourceRefRaw ? sourceRefRaw.slice(0, 240) : null;
    const note =
      (typeof o.remarks === "string" ? o.remarks.trim().slice(0, 4000) : "") ||
      (typeof o.message === "string" ? o.message.trim().slice(0, 4000) : "") ||
      (typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "");
    const label =
      typeof o.label === "string" ? o.label.trim().slice(0, 240) || null : null;
    const event =
      typeof body.event === "string" && body.event.trim()
        ? body.event.trim().slice(0, 120)
        : "tms_event_v1";
    return {
      ok: true,
      data: {
        event,
        shipmentId,
        note,
        milestone: {
          code: milestoneCode,
          actualAt,
          plannedAt,
          predictedAt,
          label,
          notes: note || null,
          sourceRef,
        },
      },
    };
  }

  /**
   * Flat visibility JSON under `visibilityPayload` (not nested like `tmsPayload` schema).
   * Common when a partner wraps our shipment id + status code + ISO timestamp only.
   */
  if (format === "visibility_flat_v1") {
    const vp = body.visibilityPayload;
    if (!vp || typeof vp !== "object" || Array.isArray(vp)) {
      return { ok: false, error: "visibilityPayload object required for visibility_flat_v1" };
    }
    const o = vp as Record<string, unknown>;
    const shipmentId =
      (typeof o.shipmentId === "string" ? o.shipmentId.trim() : "") ||
      (typeof o.shipment_id === "string" ? o.shipment_id.trim() : "") ||
      (typeof o.shipmentCuid === "string" ? o.shipmentCuid.trim() : "") ||
      (typeof o.shipment_cuid === "string" ? o.shipment_cuid.trim() : "");
    const codeRaw =
      (typeof o.milestoneCode === "string" ? o.milestoneCode : "") ||
      (typeof o.milestone_code === "string" ? o.milestone_code : "") ||
      (typeof o.eventCode === "string" ? o.eventCode : "") ||
      (typeof o.event_code === "string" ? o.event_code : "") ||
      (typeof o.statusCode === "string" ? o.statusCode : "") ||
      (typeof o.status_code === "string" ? o.status_code : "");
    const milestoneCode = sanitizeMilestoneCode(codeRaw);
    const tsRaw =
      o.occurredAt ??
      o.occurred_at ??
      o.eventTime ??
      o.event_time ??
      o.timestamp ??
      o.visibilityTimestamp ??
      o.visibility_timestamp;
    const actualAt = parseIsoDate(tsRaw);
    const plannedAt = parseIsoDate(o.plannedAt ?? o.planned_at);
    const predictedAt = parseIsoDate(o.predictedAt ?? o.predicted_at);
    if (actualAt === "invalid" || plannedAt === "invalid" || predictedAt === "invalid") {
      return { ok: false, error: "Invalid ISO date in visibility_flat_v1 payload" };
    }
    if (!shipmentId) {
      return {
        ok: false,
        error: "visibilityPayload.shipmentId | shipment_id | shipmentCuid required",
      };
    }
    if (!milestoneCode) {
      return {
        ok: false,
        error:
          "visibilityPayload milestone code required (milestoneCode | event_code | statusCode, etc.)",
      };
    }
    if (actualAt == null) {
      return {
        ok: false,
        error:
          "visibilityPayload timestamp required (occurredAt | eventTime | timestamp | visibilityTimestamp, etc.)",
      };
    }
    const sourceRefRaw =
      (typeof o.trackingId === "string" ? o.trackingId.trim() : "") ||
      (typeof o.tracking_id === "string" ? o.tracking_id.trim() : "") ||
      (typeof o.correlationId === "string" ? o.correlationId.trim() : "") ||
      (typeof o.correlation_id === "string" ? o.correlation_id.trim() : "");
    const sourceRef = sourceRefRaw ? sourceRefRaw.slice(0, 240) : null;
    const note =
      (typeof o.description === "string" ? o.description.trim().slice(0, 4000) : "") ||
      (typeof o.remarks === "string" ? o.remarks.trim().slice(0, 4000) : "") ||
      (typeof o.message === "string" ? o.message.trim().slice(0, 4000) : "") ||
      (typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "");
    const label =
      typeof o.label === "string" ? o.label.trim().slice(0, 240) || null : null;
    const event =
      typeof body.event === "string" && body.event.trim()
        ? body.event.trim().slice(0, 120)
        : "visibility_flat_v1";
    return {
      ok: true,
      data: {
        event,
        shipmentId,
        note,
        milestone: {
          code: milestoneCode,
          actualAt,
          plannedAt,
          predictedAt,
          label,
          notes: note || null,
          sourceRef,
        },
      },
    };
  }

  return {
    ok: false,
    error: `Unknown payloadFormat "${format}" (use canonical, generic_carrier_v1, ${SEA_PORT_TRACK_V1_FORMAT}, ${SIMPLE_CARRIER_EVENT_V1_FORMAT}, carrier_webhook_v1, tms_event_v1, or visibility_flat_v1)`,
  };
}

async function upsertIntegrationMilestone(params: {
  tenantId: string;
  shipmentId: string;
  actorUserId: string;
  milestone: NonNullable<NormalizedInbound["milestone"]>;
  idempotencyKey: string;
}): Promise<{ id: string; created: boolean }> {
  const { tenantId, shipmentId, actorUserId, milestone, idempotencyKey } = params;
  const sourceRef = milestone.sourceRef?.trim() || idempotencyKey;
  const existing = await prisma.ctTrackingMilestone.findFirst({
    where: {
      tenantId,
      shipmentId,
      code: milestone.code,
      sourceType: "INTEGRATION",
      sourceRef,
    },
    select: { id: true },
  });

  if (existing) {
    const row = await prisma.ctTrackingMilestone.update({
      where: { id: existing.id },
      data: {
        label: milestone.label,
        plannedAt: milestone.plannedAt,
        predictedAt: milestone.predictedAt,
        actualAt: milestone.actualAt,
        notes: milestone.notes,
        updatedById: actorUserId,
      },
    });
    await writeCtAudit({
      tenantId,
      shipmentId,
      entityType: "CtTrackingMilestone",
      entityId: row.id,
      action: "integration_upsert",
      actorUserId,
      payload: { code: milestone.code, source: "inbound_webhook" },
    });
    return { id: row.id, created: false };
  }

  const row = await prisma.ctTrackingMilestone.create({
    data: {
      tenantId,
      shipmentId,
      code: milestone.code,
      label: milestone.label,
      plannedAt: milestone.plannedAt,
      predictedAt: milestone.predictedAt,
      actualAt: milestone.actualAt,
      sourceType: "INTEGRATION",
      sourceRef,
      notes: milestone.notes,
      updatedById: actorUserId,
    },
  });
  await writeCtAudit({
    tenantId,
    shipmentId,
    entityType: "CtTrackingMilestone",
    entityId: row.id,
    action: "integration_create",
    actorUserId,
    payload: { code: milestone.code, source: "inbound_webhook" },
  });
  return { id: row.id, created: true };
}

type CarrierWebhookRowResult = {
  index: number;
  shipmentId?: string;
  milestoneId?: string;
  milestoneCreated?: boolean;
  error?: string;
};

/**
 * `payloadFormat: carrier_webhook_v1` — processes every object in `data[]` (capped at {@link getMaxCarrierWebhookRows}).
 * Per-row milestone upsert uses idempotency suffix `:index` when `idempotencyKey` is set so rows do not share one `sourceRef` fallback.
 */
async function processCarrierWebhookBatch(params: {
  tenantId: string;
  actorUserId: string;
  body: Record<string, unknown>;
  idemRaw: string;
}): Promise<InboundWebhookHttpResult> {
  const { tenantId, actorUserId, body, idemRaw } = params;
  const data = body.data;
  if (!Array.isArray(data) || data.length === 0) {
    return { status: 400, body: { error: "data must be a non-empty array for carrier_webhook_v1" } };
  }
  const maxRows = getMaxCarrierWebhookRows();
  if (data.length > maxRows) {
    return {
      status: 400,
      body: {
        error: `carrier_webhook_v1 accepts at most ${maxRows} data rows`,
        maxBatchRows: maxRows,
        payloadFormat: "carrier_webhook_v1",
      },
    };
  }

  const fallbackBodyNote = typeof body.note === "string" ? body.note.trim().slice(0, 4000) : "";
  const topLevelEvent =
    typeof body.event === "string" && body.event.trim()
      ? body.event.trim().slice(0, 120)
      : "carrier_webhook_v1";

  const receiptEntityId = `wh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const rows: CarrierWebhookRowResult[] = [];
  let firstOkShipmentId: string | null = null;
  let firstMilestoneResult: { id: string; created: boolean } | undefined;

  for (let i = 0; i < data.length; i++) {
    const cell = data[i];
    if (!cell || typeof cell !== "object" || Array.isArray(cell)) {
      rows.push({ index: i, error: `data[${i}] must be a non-empty object` });
      continue;
    }
    const parsed = parseCarrierWebhookDataRow(cell as Record<string, unknown>, fallbackBodyNote);
    if (!parsed.ok) {
      rows.push({ index: i, error: `data[${i}]: ${parsed.error}` });
      continue;
    }
    const { shipmentId, milestone } = parsed;
    if (!(await assertShipmentTenant(shipmentId, tenantId))) {
      rows.push({ index: i, shipmentId, error: "Shipment not found for this tenant." });
      continue;
    }
    const idemRow = idemRaw ? `${idemRaw}:${i}` : `${receiptEntityId}:${i}`;
    const milestoneResult = await upsertIntegrationMilestone({
      tenantId,
      shipmentId,
      actorUserId,
      milestone,
      idempotencyKey: idemRow,
    });
    rows.push({
      index: i,
      shipmentId,
      milestoneId: milestoneResult.id,
      milestoneCreated: milestoneResult.created,
    });
    if (firstMilestoneResult === undefined) {
      firstOkShipmentId = shipmentId;
      firstMilestoneResult = milestoneResult;
    }
  }

  await writeCtAudit({
    tenantId,
    shipmentId: firstOkShipmentId,
    entityType: "EXTERNAL_WEBHOOK",
    entityId: receiptEntityId,
    action: topLevelEvent,
    actorUserId,
    payload: {
      note: fallbackBodyNote || undefined,
      receivedAt: new Date().toISOString(),
      payloadFormat: "carrier_webhook_v1",
      rowCount: data.length,
      maxBatchRows: maxRows,
      milestoneId: firstMilestoneResult?.id,
    },
  });

  const okCount = rows.filter((r) => !r.error).length;
  if (okCount === 0) {
    return {
      status: 400,
      body: {
        error: "No carrier_webhook_v1 rows could be applied. See rows[].",
        entityId: receiptEntityId,
        payloadFormat: "carrier_webhook_v1",
        rowCount: data.length,
        maxBatchRows: maxRows,
        rows,
        milestonesProcessed: 0,
        milestonesFailed: rows.length,
      },
    };
  }

  const responseBody: Record<string, unknown> = {
    ok: true,
    entityId: receiptEntityId,
    payloadFormat: "carrier_webhook_v1",
    rowCount: data.length,
    maxBatchRows: maxRows,
    rows,
    milestonesProcessed: okCount,
    milestonesFailed: rows.length - okCount,
    shipmentId: firstOkShipmentId,
    milestoneId: firstMilestoneResult?.id,
    milestoneCreated: firstMilestoneResult?.created,
  };

  if (idemRaw) {
    const dedupeEntityId = hashIdempotencyEntityId(tenantId, idemRaw);
    await writeCtAudit({
      tenantId,
      shipmentId: firstOkShipmentId,
      entityType: "INBOUND_WEBHOOK_EVENT",
      entityId: dedupeEntityId,
      action: "processed",
      actorUserId,
      payload: {
        idempotencyKey: idemRaw,
        replayResponse: JSON.parse(JSON.stringify(responseBody)) as Prisma.InputJsonValue,
      },
    });
  }

  return { status: 200, body: responseBody };
}

/**
 * Control Tower inbound integration: auth + tenant resolution stay in the route handler.
 * Supports optional idempotency, `payloadFormat` alias payloads, and `CtTrackingMilestone` upserts.
 */
export async function processControlTowerInboundWebhook(params: {
  tenantId: string;
  actorUserId: string;
  body: Record<string, unknown>;
}): Promise<InboundWebhookHttpResult> {
  const idemRaw =
    typeof params.body.idempotencyKey === "string" ? params.body.idempotencyKey.trim().slice(0, MAX_IDEM) : "";

  if (idemRaw) {
    const entityId = hashIdempotencyEntityId(params.tenantId, idemRaw);
    const prior = await prisma.ctAuditLog.findFirst({
      where: {
        tenantId: params.tenantId,
        entityType: "INBOUND_WEBHOOK_EVENT",
        entityId,
      },
      orderBy: { createdAt: "desc" },
    });
    if (prior?.payload && typeof prior.payload === "object") {
      const stored = prior.payload as Record<string, unknown>;
      const replay = stored.replayResponse;
      if (replay && typeof replay === "object" && !Array.isArray(replay)) {
        return { status: 200, body: { ...(replay as Record<string, unknown>), idempotentReplay: true } };
      }
    }
  }

  const formatTrim =
    typeof params.body.payloadFormat === "string" && params.body.payloadFormat.trim()
      ? params.body.payloadFormat.trim()
      : "canonical";

  if (formatTrim === "carrier_webhook_v1") {
    return processCarrierWebhookBatch({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      body: params.body,
      idemRaw,
    });
  }

  const norm = normalizeInboundBody(params.body);
  if (!norm.ok) {
    return { status: 400, body: { error: norm.error } };
  }
  const { event, shipmentId, note, milestone } = norm.data;

  let shipmentScoped: string | null = null;
  if (shipmentId) {
    if (!(await assertShipmentTenant(shipmentId, params.tenantId))) {
      return { status: 404, body: { error: "Shipment not found for this tenant." } };
    }
    shipmentScoped = shipmentId;
  }

  if (milestone && !shipmentScoped) {
    return { status: 400, body: { error: "shipmentId is required when milestone is present." } };
  }

  const receiptEntityId = `wh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  let milestoneResult: { id: string; created: boolean } | undefined;
  if (milestone && shipmentScoped) {
    milestoneResult = await upsertIntegrationMilestone({
      tenantId: params.tenantId,
      shipmentId: shipmentScoped,
      actorUserId: params.actorUserId,
      milestone,
      idempotencyKey: idemRaw || receiptEntityId,
    });
  }
  await writeCtAudit({
    tenantId: params.tenantId,
    shipmentId: shipmentScoped,
    entityType: "EXTERNAL_WEBHOOK",
    entityId: receiptEntityId,
    action: event,
    actorUserId: params.actorUserId,
    payload: {
      note: note || undefined,
      receivedAt: new Date().toISOString(),
      milestoneId: milestoneResult?.id,
      payloadFormat:
        typeof params.body.payloadFormat === "string" ? params.body.payloadFormat.trim() : "canonical",
    },
  });

  const responseBody: Record<string, unknown> = {
    ok: true,
    entityId: receiptEntityId,
    shipmentId: shipmentScoped,
    milestoneId: milestoneResult?.id,
    milestoneCreated: milestoneResult?.created,
  };

  if (idemRaw) {
    const dedupeEntityId = hashIdempotencyEntityId(params.tenantId, idemRaw);
    await writeCtAudit({
      tenantId: params.tenantId,
      shipmentId: shipmentScoped,
      entityType: "INBOUND_WEBHOOK_EVENT",
      entityId: dedupeEntityId,
      action: "processed",
      actorUserId: params.actorUserId,
      payload: {
        idempotencyKey: idemRaw,
        replayResponse: JSON.parse(JSON.stringify(responseBody)) as Prisma.InputJsonValue,
      },
    });
  }

  return { status: 200, body: responseBody };
}
