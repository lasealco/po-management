import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const { id } = await context.params;

  const row = await prisma.salesOrder.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      shipments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          shipmentNo: true,
          status: true,
          transportMode: true,
          carrier: true,
          trackingNo: true,
          createdAt: true,
        },
      },
    },
  });
  if (!row) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });

  return NextResponse.json({
    ...row,
    requestedShipDate: row.requestedShipDate?.toISOString() ?? null,
    requestedDeliveryDate: row.requestedDeliveryDate?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    shipments: row.shipments.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
  });
}
