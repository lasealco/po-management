import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { parseCapabilityPatchBody } from "@/lib/srm/supplier-capability-parse";
import { prisma } from "@/lib/prisma";

async function getCapOr404(supplierId: string, capId: string, tenantId: string) {
  return prisma.supplierServiceCapability.findFirst({
    where: { id: capId, supplierId, tenantId },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; capId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, capId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await getCapOr404(supplierId, capId, tenant.id);
  if (!existing) {
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

  const parsed = parseCapabilityPatchBody(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.message },
      { status: parsed.status ?? 400 },
    );
  }

  const row = await prisma.supplierServiceCapability.update({
    where: { id: capId },
    data: parsed.data,
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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; capId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, capId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await getCapOr404(supplierId, capId, tenant.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.supplierServiceCapability.delete({ where: { id: capId } });
  return NextResponse.json({ ok: true });
}
