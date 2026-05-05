/**
 * BF-88 — tenant ATP soft-reservation tier policy (TTL + priority) and optional pick-allocation priority floor.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import {
  softReservedQtyByBalanceIds,
  softReservedQtyByBalanceIdsForPickAllocationBf88,
} from "./soft-reservation";

export const ATP_RESERVATION_POLICY_BF88_SCHEMA_VERSION = "bf88.v1" as const;

const MAX_TTL_SECONDS = 86400 * 366;
const MAX_TIERS = 40;

export type AtpReservationTierBf88 = {
  ttlSeconds: number;
  priorityBf88: number;
  matchTierTag?: string | null;
  matchReferenceType?: string | null;
  matchReferenceTypePrefix?: string | null;
  matchReferenceIdPrefix?: string | null;
};

export type AtpReservationPolicyBf88 = {
  schemaVersion: typeof ATP_RESERVATION_POLICY_BF88_SCHEMA_VERSION;
  defaultTtlSeconds: number;
  defaultPriorityBf88: number;
  /**
   * When non-null, pick/replen/STO-ship allocation ATP subtracts only reservations with
   * `priorityBf88 >= floor`. Dashboard ATP (BF-36 table) remains strict (all soft qty).
   */
  pickAllocationSoftReservationPriorityFloorBf88: number | null;
  tiers: AtpReservationTierBf88[];
};

export type ParsedAtpReservationPolicyBf88 = {
  policy: AtpReservationPolicyBf88;
  notice?: string;
};

const DEFAULT_POLICY: AtpReservationPolicyBf88 = {
  schemaVersion: ATP_RESERVATION_POLICY_BF88_SCHEMA_VERSION,
  defaultTtlSeconds: 3600,
  defaultPriorityBf88: 100,
  pickAllocationSoftReservationPriorityFloorBf88: null,
  tiers: [],
};

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function nonEmpty(s: unknown): string | null {
  if (s === undefined || s === null) return null;
  const t = String(s).trim();
  return t.length > 0 ? t : null;
}

export function tierHasMatchersBf88(tier: AtpReservationTierBf88): boolean {
  return Boolean(
    nonEmpty(tier.matchTierTag) ||
      nonEmpty(tier.matchReferenceType) ||
      nonEmpty(tier.matchReferenceTypePrefix) ||
      nonEmpty(tier.matchReferenceIdPrefix),
  );
}

function tierMatchesBf88(
  tier: AtpReservationTierBf88,
  refType: string,
  refId: string,
  tierTag: string,
): boolean {
  const mTag = nonEmpty(tier.matchTierTag);
  if (mTag !== null && tierTag !== mTag) return false;

  const mExact = nonEmpty(tier.matchReferenceType);
  if (mExact !== null && refType !== mExact) return false;

  const mTypePre = nonEmpty(tier.matchReferenceTypePrefix);
  if (mTypePre !== null && !refType.startsWith(mTypePre)) return false;

  const mIdPre = nonEmpty(tier.matchReferenceIdPrefix);
  if (mIdPre !== null && !refId.startsWith(mIdPre)) return false;

  return true;
}

/** Ordered tiers: first match wins (same row as firewall-style rules). */
export function resolveTierForSoftReservationBf88(
  policy: AtpReservationPolicyBf88,
  ctx: { referenceType: string | null; referenceId: string | null; tierTag: string | null },
): { ttlSeconds: number; priorityBf88: number } {
  const refType = ctx.referenceType?.trim() ?? "";
  const refId = ctx.referenceId?.trim() ?? "";
  const tierTag = ctx.tierTag?.trim() ?? "";

  for (const tier of policy.tiers) {
    if (!tierHasMatchersBf88(tier)) continue;
    if (!tierMatchesBf88(tier, refType, refId, tierTag)) continue;
    return {
      ttlSeconds: clampInt(tier.ttlSeconds, 1, MAX_TTL_SECONDS),
      priorityBf88: clampInt(tier.priorityBf88, 0, 100_000),
    };
  }
  return {
    ttlSeconds: clampInt(policy.defaultTtlSeconds, 1, MAX_TTL_SECONDS),
    priorityBf88: clampInt(policy.defaultPriorityBf88, 0, 100_000),
  };
}

function parseTierUnknown(raw: unknown): AtpReservationTierBf88 | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const ttlRaw = o.ttlSeconds ?? o.ttlSec;
  const ttl = Number(ttlRaw);
  const priRaw = o.priorityBf88 ?? o.priority;
  const priorityBf88 = Number(priRaw);
  if (!Number.isFinite(ttl) || !Number.isFinite(priorityBf88)) return null;
  const tier: AtpReservationTierBf88 = {
    ttlSeconds: ttl,
    priorityBf88,
    matchTierTag: nonEmpty(o.matchTierTag),
    matchReferenceType: nonEmpty(o.matchReferenceType),
    matchReferenceTypePrefix: nonEmpty(o.matchReferenceTypePrefix),
    matchReferenceIdPrefix: nonEmpty(o.matchReferenceIdPrefix),
  };
  if (!tierHasMatchersBf88(tier)) return null;
  return tier;
}

/** Reads tenant JSON → canonical policy + optional parse notice when shape is off. */
export function parseAtpReservationPolicyBf88Json(raw: unknown): ParsedAtpReservationPolicyBf88 {
  let notice: string | undefined;
  if (raw == null) {
    return { policy: { ...DEFAULT_POLICY } };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    notice = "Stored ATP reservation policy JSON was not an object — defaults applied.";
    return { policy: { ...DEFAULT_POLICY }, notice };
  }
  const src = raw as Record<string, unknown>;
  if (src.schemaVersion !== ATP_RESERVATION_POLICY_BF88_SCHEMA_VERSION) {
    notice = "ATP reservation policy schemaVersion mismatch — defaults applied.";
    return { policy: { ...DEFAULT_POLICY }, notice };
  }

  let defaultTtlSeconds = DEFAULT_POLICY.defaultTtlSeconds;
  const dttl = Number(src.defaultTtlSeconds);
  if (Number.isFinite(dttl)) defaultTtlSeconds = clampInt(dttl, 1, MAX_TTL_SECONDS);

  let defaultPriorityBf88 = DEFAULT_POLICY.defaultPriorityBf88;
  const dp = Number(src.defaultPriorityBf88);
  if (Number.isFinite(dp)) defaultPriorityBf88 = clampInt(dp, 0, 100_000);

  let pickFloor: number | null = null;
  if (src.pickAllocationSoftReservationPriorityFloorBf88 === null) {
    pickFloor = null;
  } else if (src.pickAllocationSoftReservationPriorityFloorBf88 !== undefined) {
    const f = Number(src.pickAllocationSoftReservationPriorityFloorBf88);
    if (Number.isFinite(f)) pickFloor = clampInt(f, 0, 100_000);
    else notice = notice ?? "Invalid pick allocation priority floor — ignored (null).";
  }

  const tiersIn = Array.isArray(src.tiers) ? src.tiers : [];
  const tiers: AtpReservationTierBf88[] = [];
  let skipped = 0;
  for (const row of tiersIn.slice(0, MAX_TIERS)) {
    const t = parseTierUnknown(row);
    if (!t) {
      skipped++;
      continue;
    }
    tiers.push({
      ...t,
      ttlSeconds: clampInt(t.ttlSeconds, 1, MAX_TTL_SECONDS),
      priorityBf88: clampInt(t.priorityBf88, 0, 100_000),
    });
  }
  if (skipped > 0 && !notice) {
    notice = `${skipped} tier row(s) skipped (invalid shape or missing matchers).`;
  }
  if (tiersIn.length > MAX_TIERS && !notice) {
    notice = `Only first ${MAX_TIERS} tiers kept.`;
  }

  return {
    policy: {
      schemaVersion: ATP_RESERVATION_POLICY_BF88_SCHEMA_VERSION,
      defaultTtlSeconds,
      defaultPriorityBf88,
      pickAllocationSoftReservationPriorityFloorBf88: pickFloor,
      tiers,
    },
    notice,
  };
}

export function atpReservationPolicyBf88ToStoredJson(
  policy: AtpReservationPolicyBf88,
): Prisma.InputJsonValue {
  return {
    schemaVersion: policy.schemaVersion,
    defaultTtlSeconds: policy.defaultTtlSeconds,
    defaultPriorityBf88: policy.defaultPriorityBf88,
    pickAllocationSoftReservationPriorityFloorBf88: policy.pickAllocationSoftReservationPriorityFloorBf88,
    tiers: policy.tiers.map((t) => ({
      ttlSeconds: t.ttlSeconds,
      priorityBf88: t.priorityBf88,
      ...(nonEmpty(t.matchTierTag) ? { matchTierTag: nonEmpty(t.matchTierTag) } : {}),
      ...(nonEmpty(t.matchReferenceType) ? { matchReferenceType: nonEmpty(t.matchReferenceType) } : {}),
      ...(nonEmpty(t.matchReferenceTypePrefix)
        ? { matchReferenceTypePrefix: nonEmpty(t.matchReferenceTypePrefix) }
        : {}),
      ...(nonEmpty(t.matchReferenceIdPrefix)
        ? { matchReferenceIdPrefix: nonEmpty(t.matchReferenceIdPrefix) }
        : {}),
    })),
  };
}

export type AtpReservationPolicyBf88PostDraft = {
  defaultTtlSeconds: unknown;
  defaultPriorityBf88: unknown;
  pickAllocationSoftReservationPriorityFloorBf88: unknown;
  tiers: unknown;
};

export function validateAtpReservationPolicyDraftFromPost(
  draft: AtpReservationPolicyBf88PostDraft,
): { ok: true; policy: AtpReservationPolicyBf88 } | { ok: false; error: string } {
  const defaultTtlSeconds = Number(draft.defaultTtlSeconds);
  const defaultPriorityBf88 = Number(draft.defaultPriorityBf88);
  if (!Number.isFinite(defaultTtlSeconds) || defaultTtlSeconds <= 0 || defaultTtlSeconds > MAX_TTL_SECONDS) {
    return { ok: false, error: `atpReservationDefaultTtlSecondsBf88 must be 1–${MAX_TTL_SECONDS}.` };
  }
  if (!Number.isFinite(defaultPriorityBf88) || defaultPriorityBf88 < 0 || defaultPriorityBf88 > 100_000) {
    return { ok: false, error: "atpReservationDefaultPriorityBf88 must be 0–100000." };
  }

  let pickAllocationSoftReservationPriorityFloorBf88: number | null = null;
  const floorRaw = draft.pickAllocationSoftReservationPriorityFloorBf88;
  if (floorRaw === undefined || floorRaw === null || floorRaw === "") {
    pickAllocationSoftReservationPriorityFloorBf88 = null;
  } else {
    const f = Number(floorRaw);
    if (!Number.isFinite(f) || f < 0 || f > 100_000) {
      return {
        ok: false,
        error: "atpReservationPickFloorPriorityBf88 must be 0–100000, null, or omitted.",
      };
    }
    pickAllocationSoftReservationPriorityFloorBf88 = clampInt(f, 0, 100_000);
  }

  if (!Array.isArray(draft.tiers)) {
    return { ok: false, error: "atpReservationTiersBf88 must be an array." };
  }
  if (draft.tiers.length > MAX_TIERS) {
    return { ok: false, error: `atpReservationTiersBf88 max ${MAX_TIERS} rows.` };
  }

  const tiers: AtpReservationTierBf88[] = [];
  for (let i = 0; i < draft.tiers.length; i++) {
    const t = parseTierUnknown(draft.tiers[i]);
    if (!t) {
      return {
        ok: false,
        error: `atpReservationTiersBf88[${i}] invalid (needs matchers + ttlSeconds + priorityBf88).`,
      };
    }
    tiers.push({
      ...t,
      ttlSeconds: clampInt(t.ttlSeconds, 1, MAX_TTL_SECONDS),
      priorityBf88: clampInt(t.priorityBf88, 0, 100_000),
    });
  }

  return {
    ok: true,
    policy: {
      schemaVersion: ATP_RESERVATION_POLICY_BF88_SCHEMA_VERSION,
      defaultTtlSeconds: clampInt(defaultTtlSeconds, 1, MAX_TTL_SECONDS),
      defaultPriorityBf88: clampInt(defaultPriorityBf88, 0, 100_000),
      pickAllocationSoftReservationPriorityFloorBf88,
      tiers,
    },
  };
}

export async function loadPickAllocationSoftReservedQtyByBalanceIdsBf88(
  db: Pick<PrismaClient, "tenant" | "wmsInventorySoftReservation">,
  tenantId: string,
  balanceIds: string[],
): Promise<Map<string, number>> {
  if (balanceIds.length === 0) return new Map();
  const row = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { wmsAtpReservationPolicyJsonBf88: true },
  });
  const parsed = parseAtpReservationPolicyBf88Json(row?.wmsAtpReservationPolicyJsonBf88 ?? null);
  const floor = parsed.policy.pickAllocationSoftReservationPriorityFloorBf88;
  return softReservedQtyByBalanceIdsForPickAllocationBf88(db, tenantId, balanceIds, floor);
}
