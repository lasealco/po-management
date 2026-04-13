import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export async function GET() {
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

  const rows = await prisma.ctSavedFilter.findMany({
    where: { tenantId: tenant.id, userId: actorId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, filtersJson: true, createdAt: true },
  });

  return NextResponse.json({
    filters: rows.map((r) => ({
      id: r.id,
      name: r.name,
      filtersJson: r.filtersJson,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
