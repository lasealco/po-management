import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { parseRelationshipNotePatchBody } from "@/lib/srm/supplier-relationship-note-parse";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; noteId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, noteId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await prisma.supplierRelationshipNote.findFirst({
    where: { id: noteId, supplierId, tenantId: tenant.id },
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

  const parsed = parseRelationshipNotePatchBody(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const row = await prisma.supplierRelationshipNote.update({
    where: { id: noteId },
    data: { body: parsed.data.body },
  });

  return NextResponse.json({
    note: {
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; noteId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, noteId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await prisma.supplierRelationshipNote.findFirst({
    where: { id: noteId, supplierId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.supplierRelationshipNote.delete({ where: { id: noteId } });
  return NextResponse.json({ ok: true });
}
