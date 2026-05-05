/**
 * BF-82 — tamper-evident movement ledger tail export via deterministic SHA-256 chaining.
 * Hashes are computed at export time from canonical row payloads (sorted-key JSON).
 * See docs/wms/WMS_MOVEMENT_AUDIT_CHAIN_BF82.md.
 */
import { createHash } from "node:crypto";

import type { InventoryMovementType, Prisma, PrismaClient } from "@prisma/client";

import {
  MOVEMENT_LEDGER_TYPES,
  movementLedgerWhere,
  type ParsedMovementLedgerQuery,
} from "@/lib/wms/movement-ledger-query";
import type { WmsViewReadScope } from "@/lib/wms/wms-read-scope";

export const BF82_SCHEMA_VERSION = "bf82.v1" as const;

/** 256-bit genesis link (hex). Each tenant export starts folding from this. */
export const BF82_GENESIS_HASH_HEX =
  "0000000000000000000000000000000000000000000000000000000000000000";

export type ParsedMovementAuditChainQueryBf82 = {
  since?: Date;
  until?: Date;
  warehouseId?: string;
  movementType?: InventoryMovementType;
  /** Rows to include after filters, ordered by createdAt asc, id asc. */
  cap: number;
};

function hexToBuf32(hex: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error(`BF82 expected 64 hex chars, got length ${hex.length}`);
  }
  return Buffer.from(hex, "hex");
}

/** Fold rolling chain: chain_i = SHA256(chain_{i-1} ‖ entryDigest_i) — binary concat of digests. */
export function bf82FoldChain(prevChainHex: string, entryDigestHex: string): string {
  return createHash("sha256")
    .update(hexToBuf32(prevChainHex))
    .update(hexToBuf32(entryDigestHex))
    .digest("hex");
}

function stableJsonValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stableJsonValue);
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = stableJsonValue(obj[k]);
  }
  return out;
}

export type InventoryMovementBf82CanonInput = {
  id: string;
  tenantId: string;
  warehouseId: string;
  binId: string | null;
  productId: string;
  movementType: InventoryMovementType;
  quantity: Prisma.Decimal;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  custodySegmentJson: Prisma.JsonValue | null;
  co2eEstimateGrams: Prisma.Decimal | null;
  co2eStubJson: Prisma.JsonValue | null;
  /** BF-97 — indicative upstream Scope 3 rollup grams for this movement line. */
  co2eScope3UpstreamHintGramsBf97: Prisma.Decimal | null;
  createdById: string;
  createdAt: Date;
};

/** Canonical JSON string for hashing — deterministic across Node versions for fixed payloads. */
export function canonicalMovementJsonBf82(row: InventoryMovementBf82CanonInput): string {
  const canon: Record<string, unknown> = {
    binId: row.binId,
    co2eEstimateGrams: row.co2eEstimateGrams ? row.co2eEstimateGrams.toString() : null,
    co2eStubJson: row.co2eStubJson,
    createdAt: row.createdAt.toISOString(),
    createdById: row.createdById,
    custodySegmentJson: row.custodySegmentJson,
    id: row.id,
    movementType: row.movementType,
    note: row.note,
    productId: row.productId,
    quantity: row.quantity.toString(),
    referenceId: row.referenceId,
    referenceType: row.referenceType,
    tenantId: row.tenantId,
    warehouseId: row.warehouseId,
  };
  if (row.co2eScope3UpstreamHintGramsBf97 != null) {
    canon.co2eScope3UpstreamHintGramsBf97 = row.co2eScope3UpstreamHintGramsBf97.toString();
  }
  return JSON.stringify(stableJsonValue(canon));
}

export function movementEntryDigestHexBf82(row: InventoryMovementBf82CanonInput): string {
  return createHash("sha256").update(canonicalMovementJsonBf82(row), "utf8").digest("hex");
}

/** Parse GET `/api/wms/movement-audit-chain` query. Invalid dates → `undefined` (ignored). */
export function parseMovementAuditChainQueryBf82(
  searchParams: URLSearchParams,
): ParsedMovementAuditChainQueryBf82 {
  let since: Date | undefined;
  let until: Date | undefined;
  const rawSince = searchParams.get("since")?.trim();
  const rawUntil = searchParams.get("until")?.trim();
  if (rawSince) {
    const d = new Date(rawSince);
    if (!Number.isNaN(d.getTime())) since = d;
  }
  if (rawUntil) {
    const d = new Date(rawUntil);
    if (!Number.isNaN(d.getTime())) until = d;
  }
  const warehouseId = searchParams.get("warehouseId")?.trim() || undefined;
  const rawType = searchParams.get("movementType")?.trim();
  const movementType =
    rawType && (MOVEMENT_LEDGER_TYPES as string[]).includes(rawType)
      ? (rawType as InventoryMovementType)
      : undefined;
  const rawCap = searchParams.get("cap")?.trim();
  let cap = 200;
  if (rawCap) {
    const n = Number.parseInt(rawCap, 10);
    if (Number.isFinite(n)) cap = Math.min(1000, Math.max(1, n));
  }
  return { since, until, warehouseId, movementType, cap };
}

export type MovementAuditChainBf82Doc = {
  schemaVersion: typeof BF82_SCHEMA_VERSION;
  tenantId: string;
  exportedAt: string;
  orderingNote: string;
  filters: {
    since?: string;
    until?: string;
    warehouseId?: string;
    movementType?: string;
    cap: number;
  };
  genesisHash: typeof BF82_GENESIS_HASH_HEX;
  chainTailHash: string;
  entryCount: number;
  entries: Array<{
    movementId: string;
    createdAt: string;
    movementType: InventoryMovementType;
    warehouseId: string;
    productId: string;
    quantity: string;
    entryDigest: string;
    chainHash: string;
  }>;
};

export async function loadMovementAuditChainBf82(
  prisma: PrismaClient,
  tenantId: string,
  viewScope: WmsViewReadScope,
  q: ParsedMovementAuditChainQueryBf82,
): Promise<MovementAuditChainBf82Doc> {
  const ledgerWhere = movementLedgerWhere(tenantId, {
    warehouseId: q.warehouseId,
    movementType: q.movementType,
    since: q.since,
    until: q.until,
    limit: q.cap,
  } satisfies ParsedMovementLedgerQuery);
  const scoped: Prisma.InventoryMovementWhereInput = viewScope.inventoryProduct
    ? { AND: [ledgerWhere, { product: viewScope.inventoryProduct }] }
    : ledgerWhere;

  const rows = await prisma.inventoryMovement.findMany({
    where: scoped,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: q.cap,
    select: {
      id: true,
      tenantId: true,
      warehouseId: true,
      binId: true,
      productId: true,
      movementType: true,
      quantity: true,
      referenceType: true,
      referenceId: true,
      note: true,
      custodySegmentJson: true,
      co2eEstimateGrams: true,
      co2eStubJson: true,
      co2eScope3UpstreamHintGramsBf97: true,
      createdById: true,
      createdAt: true,
    },
  });

  let chain = BF82_GENESIS_HASH_HEX;
  const entries: MovementAuditChainBf82Doc["entries"] = [];
  for (const r of rows) {
    const rowInput: InventoryMovementBf82CanonInput = {
      id: r.id,
      tenantId: r.tenantId,
      warehouseId: r.warehouseId,
      binId: r.binId,
      productId: r.productId,
      movementType: r.movementType,
      quantity: r.quantity,
      referenceType: r.referenceType,
      referenceId: r.referenceId,
      note: r.note,
      custodySegmentJson: r.custodySegmentJson,
      co2eEstimateGrams: r.co2eEstimateGrams,
      co2eStubJson: r.co2eStubJson,
      co2eScope3UpstreamHintGramsBf97: r.co2eScope3UpstreamHintGramsBf97,
      createdById: r.createdById,
      createdAt: r.createdAt,
    };
    const entryDigest = movementEntryDigestHexBf82(rowInput);
    chain = bf82FoldChain(chain, entryDigest);
    entries.push({
      movementId: r.id,
      createdAt: r.createdAt.toISOString(),
      movementType: r.movementType,
      warehouseId: r.warehouseId,
      productId: r.productId,
      quantity: r.quantity.toString(),
      entryDigest,
      chainHash: chain,
    });
  }

  return {
    schemaVersion: BF82_SCHEMA_VERSION,
    tenantId,
    exportedAt: new Date().toISOString(),
    orderingNote:
      "Rows are ordered by createdAt ascending, then id ascending. UI ledger sort does not affect this chain.",
    filters: {
      since: q.since?.toISOString(),
      until: q.until?.toISOString(),
      warehouseId: q.warehouseId,
      movementType: q.movementType,
      cap: q.cap,
    },
    genesisHash: BF82_GENESIS_HASH_HEX,
    chainTailHash: chain,
    entryCount: entries.length,
    entries,
  };
}
