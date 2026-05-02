import type { InventoryMovementType, Prisma } from "@prisma/client";

export const MOVEMENT_LEDGER_TYPES: InventoryMovementType[] = [
  "RECEIPT",
  "PUTAWAY",
  "PICK",
  "ADJUSTMENT",
  "SHIPMENT",
  "STO_SHIP",
  "STO_RECEIVE",
];

export type ParsedMovementLedgerQuery = {
  warehouseId?: string;
  movementType?: InventoryMovementType;
  since?: Date;
  until?: Date;
  limit: number;
};

/** Parse `GET /api/wms` ledger query params; returns `undefined` if no movement filter params present. */
export function parseMovementLedgerQuery(
  searchParams: URLSearchParams,
): ParsedMovementLedgerQuery | undefined {
  const has =
    searchParams.has("mvWarehouse") ||
    searchParams.has("mvType") ||
    searchParams.has("mvSince") ||
    searchParams.has("mvUntil") ||
    searchParams.has("mvLimit");
  if (!has) return undefined;

  const warehouseId = searchParams.get("mvWarehouse")?.trim() || undefined;
  const rawType = searchParams.get("mvType")?.trim();
  const movementType =
    rawType && (MOVEMENT_LEDGER_TYPES as string[]).includes(rawType)
      ? (rawType as InventoryMovementType)
      : undefined;
  let since: Date | undefined;
  let until: Date | undefined;
  const rawSince = searchParams.get("mvSince")?.trim();
  const rawUntil = searchParams.get("mvUntil")?.trim();
  if (rawSince) {
    const d = new Date(rawSince);
    if (!Number.isNaN(d.getTime())) since = d;
  }
  if (rawUntil) {
    const d = new Date(rawUntil);
    if (!Number.isNaN(d.getTime())) until = d;
  }
  const rawLimit = searchParams.get("mvLimit")?.trim();
  let limit = 80;
  if (rawLimit) {
    const n = Number.parseInt(rawLimit, 10);
    if (Number.isFinite(n)) limit = Math.min(300, Math.max(1, n));
  }

  return { warehouseId, movementType, since, until, limit };
}

export function movementLedgerWhere(
  tenantId: string,
  q: ParsedMovementLedgerQuery,
): Prisma.InventoryMovementWhereInput {
  const where: Prisma.InventoryMovementWhereInput = { tenantId };
  if (q.warehouseId) where.warehouseId = q.warehouseId;
  if (q.movementType) where.movementType = q.movementType;
  if (q.since || q.until) {
    where.createdAt = {};
    if (q.since) where.createdAt.gte = q.since;
    if (q.until) where.createdAt.lte = q.until;
  }
  return where;
}
