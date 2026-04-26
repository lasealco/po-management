import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { fetchSupplierOrderAnalytics } from "@/lib/supplier-order-analytics";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supplierGate = await requireApiGrant("org.suppliers", "view");
  if (supplierGate) return supplierGate;
  const orderGate = await requireApiGrant("org.orders", "view");
  if (orderGate) return orderGate;

  const { id } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true },
  });
  if (!supplier) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }

  const analytics = await fetchSupplierOrderAnalytics(prisma, tenant.id, id);
  return NextResponse.json({ analytics });
}
