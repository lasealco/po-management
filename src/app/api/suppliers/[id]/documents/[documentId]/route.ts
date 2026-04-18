import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { parseSupplierDocumentPatchBody } from "@/lib/srm/supplier-document-parse";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, documentId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await prisma.supplierDocument.findFirst({
    where: { id: documentId, supplierId, tenantId: tenant.id },
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

  const parsed = parseSupplierDocumentPatchBody(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const row = await prisma.supplierDocument.update({
    where: { id: documentId },
    data: parsed.data,
  });

  return NextResponse.json({
    document: {
      id: row.id,
      title: row.title,
      category: row.category,
      referenceUrl: row.referenceUrl,
      notes: row.notes,
      documentDate: row.documentDate?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; documentId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, documentId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await prisma.supplierDocument.findFirst({
    where: { id: documentId, supplierId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.supplierDocument.delete({ where: { id: documentId } });
  return NextResponse.json({ ok: true });
}
