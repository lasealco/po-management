import { prisma } from "@/lib/prisma";

export async function nextSalesOrderNumber(tenantId: string): Promise<string> {
  const stamp = Date.now().toString().slice(-6);
  let candidate = `SO-${stamp}`;
  for (let i = 0; i < 8; i += 1) {
    const exists = await prisma.salesOrder.findFirst({
      where: { tenantId, soNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `SO-${stamp}-${i + 1}`;
  }
  return `SO-${stamp}-${Math.floor(Math.random() * 1000)}`;
}
