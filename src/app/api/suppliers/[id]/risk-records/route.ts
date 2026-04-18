import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { parseRiskRecordCreateBody } from "@/lib/srm/supplier-risk-record-parse";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!supplier) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object." }, { status: 400 });
  }

  const parsed = parseRiskRecordCreateBody(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const row = await prisma.supplierRiskRecord.create({
    data: {
      tenantId: tenant.id,
      supplierId,
      title: parsed.data.title,
      category: parsed.data.category,
      severity: parsed.data.severity,
      details: parsed.data.details,
      identifiedAt: parsed.data.identifiedAt,
    },
  });

  return NextResponse.json({
    risk: {
      id: row.id,
      title: row.title,
      category: row.category,
      severity: row.severity,
      status: row.status,
      details: row.details,
      identifiedAt: row.identifiedAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
    },
  });
}
