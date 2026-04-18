import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { SupplierRiskStatus } from "@prisma/client";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { parseRiskRecordPatchBody } from "@/lib/srm/supplier-risk-record-parse";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; riskId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, riskId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await prisma.supplierRiskRecord.findFirst({
    where: { id: riskId, supplierId, tenantId: tenant.id },
  });
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

  const parsed = parseRiskRecordPatchBody(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const data: Prisma.SupplierRiskRecordUpdateInput = { ...parsed.data };
  const nextStatus = parsed.data.status ?? existing.status;
  if (nextStatus === SupplierRiskStatus.closed) {
    if (parsed.data.closedAt === undefined && existing.closedAt === null) {
      data.closedAt = new Date();
    }
  } else if (parsed.data.status !== undefined) {
    data.closedAt = null;
  }

  const row = await prisma.supplierRiskRecord.update({
    where: { id: riskId },
    data,
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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; riskId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, riskId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await prisma.supplierRiskRecord.findFirst({
    where: { id: riskId, supplierId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.supplierRiskRecord.delete({ where: { id: riskId } });
  return NextResponse.json({ ok: true });
}
