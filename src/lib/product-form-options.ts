import { prisma } from "@/lib/prisma";

/** Dropdown/checkbox data for product create & edit forms. */
export async function getProductFormOptions(tenantId: string) {
  const [categories, divisions, offices, suppliers] = await Promise.all([
    prisma.productCategory.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.productDivision.findMany({
      where: { tenantId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.supplierOffice.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      include: { supplier: { select: { name: true } } },
    }),
    prisma.supplier.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    categories,
    divisions,
    supplierOffices: offices.map((o) => ({
      id: o.id,
      label: `${o.supplier.name} — ${o.name}`,
    })),
    suppliers,
  };
}
