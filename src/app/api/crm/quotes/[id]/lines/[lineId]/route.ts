import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recalcQuoteSubtotal } from "@/lib/crm-quote-recalc";
import { crmOwnerRelationClause, getCrmAccessScope } from "@/lib/crm-scope";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function assertLineAccess(
  tenantId: string,
  quoteId: string,
  lineId: string,
  actorId: string,
) {
  const scope = await getCrmAccessScope(tenantId, actorId);
  return prisma.crmQuoteLine.findFirst({
    where: {
      id: lineId,
      quoteId,
      quote: {
        tenantId,
        ...crmOwnerRelationClause(scope),
      },
    },
    include: { quote: true },
  });
}

type PatchBody = {
  description?: string;
  quantity?: string | number;
  unitPrice?: string | number;
  sortOrder?: number;
  /** BF-14 — WMS `Product.sku` mapping; null clears. */
  inventorySku?: string | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; lineId: string }> },
) {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id: quoteId, lineId } = await context.params;
  const existing = await assertLineAccess(tenant.id, quoteId, lineId, actorId);
  if (!existing) {
    return toApiErrorResponse({ error: "Line not found.", code: "NOT_FOUND", status: 404 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.description !== undefined) data.description = body.description.trim();
  if (body.inventorySku !== undefined) {
    const raw = body.inventorySku;
    data.inventorySku =
      raw === null || String(raw).trim() === "" ? null : String(raw).trim().slice(0, 128);
  }
  if (body.quantity !== undefined) {
    const qty = Number(body.quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      return toApiErrorResponse({ error: "Invalid quantity.", code: "BAD_INPUT", status: 400 });
    }
    data.quantity = new Prisma.Decimal(String(qty));
  }
  if (body.unitPrice !== undefined) {
    const price = Number(body.unitPrice);
    if (Number.isNaN(price) || price < 0) {
      return toApiErrorResponse({ error: "Invalid unitPrice.", code: "BAD_INPUT", status: 400 });
    }
    data.unitPrice = new Prisma.Decimal(String(price));
  }
  if (body.sortOrder !== undefined) data.sortOrder = Math.round(body.sortOrder);

  if (Object.keys(data).length === 0) {
    return toApiErrorResponse({ error: "No fields to update.", code: "BAD_INPUT", status: 400 });
  }

  const line = await prisma.$transaction(async (tx) => {
    const updated = await tx.crmQuoteLine.update({
      where: { id: lineId },
      data: data as never,
    });
    const q = Number(updated.quantity);
    const p = Number(updated.unitPrice);
    await tx.crmQuoteLine.update({
      where: { id: lineId },
      data: { extendedAmount: new Prisma.Decimal((q * p).toFixed(2)) },
    });
    await recalcQuoteSubtotal(tx, quoteId);
    return tx.crmQuoteLine.findUniqueOrThrow({ where: { id: lineId } });
  });

  return NextResponse.json({ line });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; lineId: string }> },
) {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id: quoteId, lineId } = await context.params;
  const existing = await assertLineAccess(tenant.id, quoteId, lineId, actorId);
  if (!existing) {
    return toApiErrorResponse({ error: "Line not found.", code: "NOT_FOUND", status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.crmQuoteLine.delete({ where: { id: lineId } });
    await recalcQuoteSubtotal(tx, quoteId);
  });

  return NextResponse.json({ ok: true });
}
