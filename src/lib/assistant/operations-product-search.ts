import { prisma } from "@/lib/prisma";

import type { ProductPick } from "@/lib/assistant/operations-intent";

/**
 * Fuzzy name/code/SKU search for natural-language product hints.
 */
export async function findProductCandidates(tenantId: string, hint: string): Promise<ProductPick[]> {
  const h = hint.trim().slice(0, 200);
  if (!h) return [];
  return prisma.product.findMany({
    where: {
      tenantId,
      OR: [
        { id: h },
        { sku: { equals: h, mode: "insensitive" } },
        { productCode: { equals: h, mode: "insensitive" } },
        { name: { contains: h, mode: "insensitive" } },
        { sku: { contains: h, mode: "insensitive" } },
        { productCode: { contains: h, mode: "insensitive" } },
      ],
    },
    take: 12,
    orderBy: { name: "asc" },
    select: { id: true, name: true, productCode: true, sku: true },
  });
}
