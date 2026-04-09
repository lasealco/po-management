import type { PrismaClient } from "@prisma/client";
import type { ParsedProductCreate } from "@/lib/parse-product-create";

export async function assertProductRelationsValid(
  tx: Pick<
    PrismaClient,
    "productCategory" | "productDivision" | "supplierOffice" | "supplier"
  >,
  tenantId: string,
  d: ParsedProductCreate,
  supplierIds: string[],
) {
  if (d.categoryId) {
    const found = await tx.productCategory.findFirst({
      where: { id: d.categoryId, tenantId },
      select: { id: true },
    });
    if (!found) throw new Error("INVALID_CATEGORY");
  }

  if (d.divisionId) {
    const found = await tx.productDivision.findFirst({
      where: { id: d.divisionId, tenantId },
      select: { id: true },
    });
    if (!found) throw new Error("INVALID_DIVISION");
  }

  if (d.supplierOfficeId) {
    const found = await tx.supplierOffice.findFirst({
      where: { id: d.supplierOfficeId, tenantId },
      select: { id: true },
    });
    if (!found) throw new Error("INVALID_OFFICE");
  }

  if (supplierIds.length) {
    const count = await tx.supplier.count({
      where: { tenantId, id: { in: supplierIds } },
    });
    if (count !== supplierIds.length) throw new Error("INVALID_SUPPLIERS");
  }
}
