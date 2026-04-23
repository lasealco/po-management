import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "view");
  if (gate) return gate;

  const { id: supplierId, docId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const doc = await prisma.srmSupplierDocument.findFirst({
    where: { id: docId, tenantId: tenant.id, supplierId },
    select: { id: true },
  });
  if (!doc) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }

  const logs = await prisma.srmSupplierDocumentAuditLog.findMany({
    where: { documentId: docId, tenantId: tenant.id },
    orderBy: { at: "desc" },
    take: 50,
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    entries: logs.map((l) => ({
      id: l.id,
      at: l.at.toISOString(),
      action: l.action,
      details: l.details,
      actor: l.actor,
    })),
  });
}
