import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recalcQuoteSubtotal } from "@/lib/crm-quote-recalc";
import { crmOwnerRelationClause, getCrmAccessScope } from "@/lib/crm-scope";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function assertQuoteAccess(
  tenantId: string,
  quoteId: string,
  actorId: string,
) {
  const scope = await getCrmAccessScope(tenantId, actorId);
  return prisma.crmQuote.findFirst({
    where: {
      id: quoteId,
      tenantId,
      ...crmOwnerRelationClause(scope),
    },
    select: { id: true },
  });
}

type PostBody = {
  description?: string;
  quantity?: string | number;
  unitPrice?: string | number;
  sortOrder?: number;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.crm", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id: quoteId } = await context.params;
  const ok = await assertQuoteAccess(tenant.id, quoteId, actorId);
  if (!ok) {
    return toApiErrorResponse({ error: "Quote not found.", code: "NOT_FOUND", status: 404 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  const description = body.description?.trim();
  const qty = body.quantity != null ? Number(body.quantity) : NaN;
  const price = body.unitPrice != null ? Number(body.unitPrice) : NaN;
  if (!description || Number.isNaN(qty) || qty <= 0 || Number.isNaN(price) || price < 0) {
    return toApiErrorResponse({ error: "description, positive quantity, and non-negative unitPrice are required.", code: "BAD_INPUT", status: 400 });
  }

  const maxSort = await prisma.crmQuoteLine.aggregate({
    where: { quoteId },
    _max: { sortOrder: true },
  });
  const sortOrder =
    typeof body.sortOrder === "number"
      ? body.sortOrder
      : (maxSort._max.sortOrder ?? -1) + 1;

  const extended = new Prisma.Decimal((qty * price).toFixed(2));

  const line = await prisma.$transaction(async (tx) => {
    const created = await tx.crmQuoteLine.create({
      data: {
        quoteId,
        sortOrder,
        description,
        quantity: new Prisma.Decimal(String(qty)),
        unitPrice: new Prisma.Decimal(String(price)),
        extendedAmount: extended,
      },
    });
    await recalcQuoteSubtotal(tx, quoteId);
    return created;
  });

  return NextResponse.json({ line }, { status: 201 });
}
