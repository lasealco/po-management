import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { parseSrmAlertCreateBody } from "@/lib/srm/supplier-srm-alert-parse";

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

  const parsed = parseSrmAlertCreateBody(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const row = await prisma.supplierSrmAlert.create({
    data: {
      tenantId: tenant.id,
      supplierId,
      title: parsed.data.title,
      message: parsed.data.message,
      severity: parsed.data.severity,
    },
  });

  return NextResponse.json({
    alert: {
      id: row.id,
      title: row.title,
      message: row.message,
      severity: row.severity,
      status: row.status,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    },
  });
}
