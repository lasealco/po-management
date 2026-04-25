import { prisma } from "@/lib/prisma";
import { parseSalesOrderIntent, type AccountCandidate, type ProductCandidate } from "./sales-order-intent";

export async function analyzeEmailSalesOrderAction({
  tenantId,
  subject,
  bodyText,
  linkedCrmAccountId,
}: {
  tenantId: string;
  subject: string;
  bodyText: string;
  linkedCrmAccountId: string | null;
}) {
  const raw = `${subject}\n\n${bodyText}`.slice(0, 8_000);
  const [crmRows, productRows, warehouses, orgUnits] = await Promise.all([
    prisma.crmAccount.findMany({
      where: { tenantId, lifecycle: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, legalName: true },
    }),
    prisma.product.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ productCode: "asc" }, { name: "asc" }],
      take: 500,
      select: { id: true, name: true, productCode: true },
    }),
    prisma.warehouse.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.orgUnit.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
  ]);

  const accounts: AccountCandidate[] = crmRows;
  const products: ProductCandidate[] = productRows;

  return parseSalesOrderIntent(
    raw,
    { accounts, products, warehouses, orgUnits },
    { accountId: linkedCrmAccountId, productId: null },
  );
}
