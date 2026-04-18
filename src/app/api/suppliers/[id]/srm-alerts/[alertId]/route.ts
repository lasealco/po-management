import { NextResponse } from "next/server";
import { SupplierSrmAlertStatus } from "@prisma/client";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { parseSrmAlertPatchBody } from "@/lib/srm/supplier-srm-alert-parse";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; alertId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, alertId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await prisma.supplierSrmAlert.findFirst({
    where: { id: alertId, supplierId, tenantId: tenant.id },
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

  const parsed = parseSrmAlertPatchBody(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const data = { ...parsed.data };
  const nextStatus = parsed.data.status ?? existing.status;
  if (nextStatus === SupplierSrmAlertStatus.resolved) {
    if (existing.resolvedAt === null && data.resolvedAt === undefined) {
      data.resolvedAt = new Date();
    }
  } else if (parsed.data.status !== undefined) {
    data.resolvedAt = null;
  }

  const row = await prisma.supplierSrmAlert.update({
    where: { id: alertId },
    data,
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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; alertId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, alertId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await prisma.supplierSrmAlert.findFirst({
    where: { id: alertId, supplierId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.supplierSrmAlert.delete({ where: { id: alertId } });
  return NextResponse.json({ ok: true });
}
