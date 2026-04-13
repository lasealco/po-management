import { prisma } from "@/lib/prisma";

const OUTBOUND_LINE_REFS = new Set(["OUTBOUND_LINE_PICK", "OUTBOUND_LINE_SHIP"]);

/** Map inventory movement id → CRM account id on linked outbound (if any). */
export async function resolveCrmAccountIdsByMovementIds(
  tenantId: string,
  movements: Array<{ id: string; referenceType: string | null; referenceId: string | null }>,
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  for (const m of movements) {
    result.set(m.id, null);
  }
  const lineIds = new Set<string>();
  for (const m of movements) {
    if (!m.referenceId) continue;
    if (m.referenceType && OUTBOUND_LINE_REFS.has(m.referenceType)) {
      lineIds.add(m.referenceId);
    }
  }
  if (lineIds.size === 0) return result;
  const lines = await prisma.outboundOrderLine.findMany({
    where: { tenantId, id: { in: [...lineIds] } },
    select: {
      id: true,
      outboundOrder: { select: { crmAccountId: true } },
    },
  });
  const crmByLine = new Map<string, string | null>();
  for (const row of lines) {
    crmByLine.set(row.id, row.outboundOrder.crmAccountId ?? null);
  }
  for (const m of movements) {
    if (!m.referenceId || !m.referenceType || !OUTBOUND_LINE_REFS.has(m.referenceType)) continue;
    result.set(m.id, crmByLine.get(m.referenceId) ?? null);
  }
  return result;
}
