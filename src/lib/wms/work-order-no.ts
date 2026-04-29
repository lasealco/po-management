import { prisma } from "@/lib/prisma";

/** Stable human-visible ids for value-add work orders (`WmsWorkOrder.workOrderNo`). */
export async function nextWorkOrderNo(tenantId: string) {
  const stamp = Date.now().toString().slice(-6);
  let candidate = `WO-${stamp}`;
  for (let i = 0; i < 8; i += 1) {
    const exists = await prisma.wmsWorkOrder.findFirst({
      where: { tenantId, workOrderNo: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `WO-${stamp}-${i + 1}`;
  }
  return `WO-${stamp}-${Math.floor(Math.random() * 1000)}`;
}
