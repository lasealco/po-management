import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ orders: [] });
  }

  const idExact = /^c[a-z0-9]{24}$/i.test(q) ? q : null;
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      tenantId: tenant.id,
      splitParentId: null,
      OR: [{ orderNumber: { contains: q, mode: "insensitive" } }, ...(idExact ? [{ id: idExact }] : [])],
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      orderNumber: true,
      supplier: { select: { name: true } },
      items: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true,
          lineNo: true,
          description: true,
          quantity: true,
        },
      },
    },
  });

  if (orders.length === 0) {
    return NextResponse.json({ orders: [] });
  }

  const orderIds = orders.map((o) => o.id);
  const shippedRows = await prisma.shipmentItem.findMany({
    where: { orderItem: { orderId: { in: orderIds } } },
    select: { orderItemId: true, quantityShipped: true },
  });
  const shippedByItem = new Map<string, Prisma.Decimal>();
  for (const r of shippedRows) {
    const prev = shippedByItem.get(r.orderItemId) ?? new Prisma.Decimal(0);
    shippedByItem.set(r.orderItemId, prev.plus(r.quantityShipped));
  }

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      supplierName: o.supplier?.name ?? null,
      items: o.items.map((it) => {
        const shipped = shippedByItem.get(it.id) ?? new Prisma.Decimal(0);
        const remaining = new Prisma.Decimal(it.quantity).minus(shipped);
        return {
          id: it.id,
          lineNo: it.lineNo,
          description: it.description,
          quantity: it.quantity.toString(),
          quantityRemaining: remaining.greaterThan(0) ? remaining.toString() : "0",
        };
      }),
    })),
  });
}
