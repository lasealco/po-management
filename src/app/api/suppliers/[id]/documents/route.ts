import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { parseSupplierDocumentCreateBody } from "@/lib/srm/supplier-document-parse";
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

  const parsed = parseSupplierDocumentCreateBody(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const row = await prisma.supplierDocument.create({
    data: {
      tenantId: tenant.id,
      supplierId,
      title: parsed.data.title,
      category: parsed.data.category,
      referenceUrl: parsed.data.referenceUrl,
      notes: parsed.data.notes,
      documentDate: parsed.data.documentDate,
    },
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
