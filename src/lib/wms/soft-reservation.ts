import type { PrismaClient } from "@prisma/client";

/** Active soft reservations: quantity summed per balance row (`expiresAt` in the future). */
export async function softReservedQtyByBalanceIds(
  db: Pick<PrismaClient, "wmsInventorySoftReservation">,
  tenantId: string,
  balanceIds: string[],
): Promise<Map<string, number>> {
  if (balanceIds.length === 0) return new Map();
  const now = new Date();
  const rows = await db.wmsInventorySoftReservation.groupBy({
    by: ["inventoryBalanceId"],
    where: {
      tenantId,
      inventoryBalanceId: { in: balanceIds },
      expiresAt: { gt: now },
    },
    _sum: { quantity: true },
  });
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.inventoryBalanceId, Number(r._sum.quantity ?? 0));
  }
  return m;
}

/** Units available for picks / moves after pick allocations and soft reservations. */
export function effectiveAvailableUnits(onHand: number, allocated: number, softReserved: number): number {
  return Math.max(0, onHand - allocated - softReserved);
}
