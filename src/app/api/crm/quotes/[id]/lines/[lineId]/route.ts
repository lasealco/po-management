import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant, userHasGlobalGrant } from "@/lib/authz";
import { recalcQuoteSubtotal } from "@/lib/crm-quote-recalc";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function assertLineAccess(
  tenantId: string,
  quoteId: string,
  lineId: string,
  actorId: string,
) {
  const canEditAll = await userHasGlobalGrant(actorId, "org.crm", "edit");
  return prisma.crmQuoteLine.findFirst({
    where: {
      id: lineId,
      quoteId,
      quote: {
        tenantId,
        ...(canEditAll ? {} : { ownerUserId: actorId }),
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
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const { id: quoteId, lineId } = await context.params;
  const existing = await assertLineAccess(tenant.id, quoteId, lineId, actorId);
  if (!existing) {
    return NextResponse.json({ error: "Line not found." }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.description !== undefined) data.description = body.description.trim();
  if (body.quantity !== undefined) {
    const qty = Number(body.quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: "Invalid quantity." }, { status: 400 });
    }
    data.quantity = new Prisma.Decimal(String(qty));
  }
  if (body.unitPrice !== undefined) {
    const price = Number(body.unitPrice);
    if (Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: "Invalid unitPrice." }, { status: 400 });
    }
    data.unitPrice = new Prisma.Decimal(String(price));
  }
  if (body.sortOrder !== undefined) data.sortOrder = Math.round(body.sortOrder);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
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
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const { id: quoteId, lineId } = await context.params;
  const existing = await assertLineAccess(tenant.id, quoteId, lineId, actorId);
  if (!existing) {
    return NextResponse.json({ error: "Line not found." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.crmQuoteLine.delete({ where: { id: lineId } });
    await recalcQuoteSubtotal(tx, quoteId);
  });

  return NextResponse.json({ ok: true });
}
