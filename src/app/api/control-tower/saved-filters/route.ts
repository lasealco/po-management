import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

function sanitizeSavedWorkbenchFilters(input: unknown): Record<string, unknown> {
  const raw =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    ...raw,
    shipperFilter: "",
    consigneeFilter: "",
    carrierFilter: "",
    supplierNameFilter: "",
    customerNameFilter: "",
  };
}

export async function GET() {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
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
      filtersJson: sanitizeSavedWorkbenchFilters(r.filtersJson),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
