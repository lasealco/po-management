import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { parseCapabilityCreateBody } from "@/lib/srm/supplier-capability-parse";
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

  const parsed = parseCapabilityCreateBody(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const row = await prisma.supplierServiceCapability.create({
    data: {
      tenantId: tenant.id,
      supplierId,
      mode: parsed.data.mode,
      subMode: parsed.data.subMode,
      serviceType: parsed.data.serviceType,
      geography: parsed.data.geography,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json({
    capability: {
      id: row.id,
      mode: row.mode,
      subMode: row.subMode,
      serviceType: row.serviceType,
      geography: row.geography,
      notes: row.notes,
    },
  });
}
