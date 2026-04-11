import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import { recalcQuoteSubtotal } from "@/lib/crm-quote-recalc";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function assertQuoteAccess(
  tenantId: string,
  quoteId: string,
  actorId: string,
) {
  const canEditAll = await userHasGlobalGrant(actorId, "org.crm", "edit");
  return prisma.crmQuote.findFirst({
    where: {
      id: quoteId,
      tenantId,
      ...(canEditAll ? {} : { ownerUserId: actorId }),
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
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const { id: quoteId } = await context.params;
  const ok = await assertQuoteAccess(tenant.id, quoteId, actorId);
  if (!ok) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const description = body.description?.trim();
  const qty = body.quantity != null ? Number(body.quantity) : NaN;
  const price = body.unitPrice != null ? Number(body.unitPrice) : NaN;
  if (!description || Number.isNaN(qty) || qty <= 0 || Number.isNaN(price) || price < 0) {
    return NextResponse.json(
      { error: "description, positive quantity, and non-negative unitPrice are required." },
      { status: 400 },
    );
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
