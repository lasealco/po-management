import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { parseSalesOrderIntent, type AccountCandidate, type ProductCandidate } from "@/lib/assistant/sales-order-intent";
import { prisma } from "@/lib/prisma";

type Body = {
  text?: unknown;
  /** When user disambiguated in the client */
  resolvedAccountId?: unknown;
  resolvedProductId?: unknown;
};

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return toApiErrorResponse({ error: "text is required.", code: "BAD_INPUT", status: 400 });
  }
  if (text.length > 8_000) {
    return toApiErrorResponse({ error: "text is too long.", code: "BAD_INPUT", status: 400 });
  }
  const resolvedAccountId = typeof body.resolvedAccountId === "string" ? body.resolvedAccountId.trim() : null;
  const resolvedProductId = typeof body.resolvedProductId === "string" ? body.resolvedProductId.trim() : null;

  const [crmRows, productRows, warehouses, orgUnits] = await Promise.all([
    prisma.crmAccount.findMany({
      where: { tenantId: tenant.id, lifecycle: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, legalName: true },
    }),
    prisma.product.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: [{ productCode: "asc" }, { name: "asc" }],
      take: 500,
      select: { id: true, name: true, productCode: true },
    }),
    prisma.warehouse.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.orgUnit.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, code: true },
    }),
  ]);

  const accounts: AccountCandidate[] = crmRows;
  const products: ProductCandidate[] = productRows;

  const result = parseSalesOrderIntent(
    text,
    { accounts, products, warehouses, orgUnits },
    { accountId: resolvedAccountId, productId: resolvedProductId },
  );

  return NextResponse.json({ ok: true, result });
}
