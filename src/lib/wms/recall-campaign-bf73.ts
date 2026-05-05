import type { Prisma } from "@prisma/client";

import { normalizeHoldReleaseGrantInput, normalizeInventoryFreezeReasonCode } from "./inventory-freeze-matrix";
import { normalizeLotCode } from "./lot-code";
import type { WmsBody } from "./wms-body";

export const RECALL_SCOPE_SCHEMA_VERSION = "bf73.v1" as const;

export type RecallScopeV1 = {
  schemaVersion: typeof RECALL_SCOPE_SCHEMA_VERSION;
  productIds: string[];
  warehouseIds: string[];
  /** When non-empty, only balances whose lot is in this list are frozen. */
  lotCodes?: string[];
};

const MAX_SCOPE_IDS = 200;
const MAX_LOT_CODES = 100;

function dedupeIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function coerceNonEmptyStringArray(
  raw: unknown,
  fieldLabel: string,
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: `${fieldLabel} must be a non-empty array of string ids.` };
  }
  const ids: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") {
      return { ok: false, error: `${fieldLabel} entries must be strings.` };
    }
    const t = x.trim();
    if (t) ids.push(t);
  }
  if (ids.length === 0) {
    return { ok: false, error: `${fieldLabel} must include at least one id.` };
  }
  const uniq = dedupeIds(ids);
  if (uniq.length > MAX_SCOPE_IDS) {
    return { ok: false, error: `${fieldLabel} exceeds maximum (${MAX_SCOPE_IDS} distinct ids).` };
  }
  return { ok: true, ids: uniq };
}

function coerceOptionalLotCodes(
  raw: unknown | undefined | null,
): { ok: true; lotCodes: string[] | undefined } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, lotCodes: undefined };
  if (!Array.isArray(raw)) {
    return { ok: false, error: "recallScopeLotCodes must be an array of strings or omitted." };
  }
  const lots: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") {
      return { ok: false, error: "recallScopeLotCodes entries must be strings." };
    }
    const t = x.trim();
    if (t) lots.push(t);
  }
  const uniq = dedupeIds(lots.map((lc) => normalizeLotCode(lc)));
  if (uniq.length > MAX_LOT_CODES) {
    return { ok: false, error: `recallScopeLotCodes exceeds maximum (${MAX_LOT_CODES} distinct lots).` };
  }
  return { ok: true, lotCodes: uniq.length ? uniq : undefined };
}

/** Parse POST body lists into a persisted bf73.v1 scope document. */
export function parseRecallScopeFromWmsBody(input: WmsBody):
  | { ok: true; scope: RecallScopeV1 }
  | { ok: false; error: string } {
  const wh = coerceNonEmptyStringArray(input.recallScopeWarehouseIds, "recallScopeWarehouseIds");
  if (!wh.ok) return wh;
  const pr = coerceNonEmptyStringArray(input.recallScopeProductIds, "recallScopeProductIds");
  if (!pr.ok) return pr;
  const lots = coerceOptionalLotCodes(input.recallScopeLotCodes);
  if (!lots.ok) return lots;
  const scope: RecallScopeV1 = {
    schemaVersion: RECALL_SCOPE_SCHEMA_VERSION,
    warehouseIds: wh.ids,
    productIds: pr.ids,
    ...(lots.lotCodes && lots.lotCodes.length ? { lotCodes: lots.lotCodes } : {}),
  };
  return { ok: true, scope };
}

export function parseStoredRecallScopeJson(raw: unknown):
  | { ok: true; scope: RecallScopeV1 }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Campaign scopeJson is missing or invalid." };
  }
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== RECALL_SCOPE_SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported recall scope schemaVersion (expected ${RECALL_SCOPE_SCHEMA_VERSION}).` };
  }
  const wh = coerceNonEmptyStringArray(o.warehouseIds, "warehouseIds");
  if (!wh.ok) return { ok: false, error: wh.error };
  const pr = coerceNonEmptyStringArray(o.productIds, "productIds");
  if (!pr.ok) return { ok: false, error: pr.error };
  const lots = coerceOptionalLotCodes(o.lotCodes ?? null);
  if (!lots.ok) return lots;
  return {
    ok: true,
    scope: {
      schemaVersion: RECALL_SCOPE_SCHEMA_VERSION,
      warehouseIds: wh.ids,
      productIds: pr.ids,
      ...(lots.lotCodes && lots.lotCodes.length ? { lotCodes: lots.lotCodes } : {}),
    },
  };
}

export function recallHoldSummaryNote(
  campaignCode: string,
  title: string,
  extraNote: string | null | undefined,
): string {
  const bits = [`Recall ${campaignCode.trim()}`, title.trim()];
  const n = extraNote?.trim();
  if (n) bits.push(n);
  return bits.join(" — ").slice(0, 500);
}

/** Applies the same balance patch as `apply_inventory_freeze` bulk scope, for every warehouse × product cell (optional lot filter). */
export async function materializeRecallCampaignBalances(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    actorId: string;
    scope: RecallScopeV1;
    holdReasonCode: string | undefined | null;
    holdReleaseGrant: string | undefined | null;
    holdNote: string;
  },
): Promise<{ ok: true; updatedCount: number } | { ok: false; error: string }> {
  const reasonParsed = normalizeInventoryFreezeReasonCode(params.holdReasonCode);
  if (!reasonParsed.ok) return { ok: false, error: reasonParsed.error };
  const grantParsed = normalizeHoldReleaseGrantInput(params.holdReleaseGrant);
  if (!grantParsed.ok) return { ok: false, error: grantParsed.error };
  const note = params.holdNote.trim().slice(0, 500) || reasonParsed.code.replaceAll("_", " ");
  const now = new Date();
  const data = {
    onHold: true,
    holdReason: note,
    holdReasonCode: reasonParsed.code,
    holdAppliedAt: now,
    holdAppliedById: params.actorId,
    holdReleaseGrant: grantParsed.grant,
  };
  let total = 0;
  for (const wh of params.scope.warehouseIds) {
    for (const pid of params.scope.productIds) {
      const whereBal: Prisma.InventoryBalanceWhereInput = {
        tenantId: params.tenantId,
        warehouseId: wh,
        productId: pid,
      };
      if (params.scope.lotCodes && params.scope.lotCodes.length > 0) {
        whereBal.lotCode = { in: params.scope.lotCodes };
      }
      const r = await tx.inventoryBalance.updateMany({ where: whereBal, data });
      total += r.count;
    }
  }
  return { ok: true, updatedCount: total };
}
