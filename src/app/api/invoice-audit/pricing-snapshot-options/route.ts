import { NextResponse } from "next/server";

import { guardInvoiceAuditSchema } from "@/app/api/invoice-audit/_lib/guard-invoice-audit-schema";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Lightweight snapshot list for invoice intake linking (no breakdownJson payload).
 */
export async function GET() {
  const gate = await requireApiGrant("org.invoice_audit", "view");
  if (gate) return gate;
  const schema = await guardInvoiceAuditSchema();
  if (schema) return schema;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const rows = await prisma.bookingPricingSnapshot.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ frozenAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      sourceType: true,
      sourceSummary: true,
      currency: true,
      totalEstimatedCost: true,
      frozenAt: true,
    },
  });

  return NextResponse.json({
    snapshots: rows.map((r) => ({
      id: r.id,
      sourceType: r.sourceType,
      sourceSummary: r.sourceSummary,
      currency: r.currency,
      totalEstimatedCost: r.totalEstimatedCost.toString(),
      frozenAt: r.frozenAt.toISOString(),
    })),
  });
}
