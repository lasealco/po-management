import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
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

  const o = body as Record<string, unknown>;
  const name =
    typeof o.name === "string" && o.name.trim() ? o.name.trim() : null;
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const title =
    typeof o.title === "string" && o.title.trim() ? o.title.trim() : null;
  const role =
    typeof o.role === "string" && o.role.trim() ? o.role.trim() : null;
  const email =
    typeof o.email === "string" && o.email.trim() ? o.email.trim() : null;
  const phone =
    typeof o.phone === "string" && o.phone.trim() ? o.phone.trim() : null;
  const notes =
    typeof o.notes === "string" && o.notes.trim() ? o.notes.trim() : null;
  const isPrimary = Boolean(o.isPrimary);

  const contact = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.supplierContact.updateMany({
        where: { supplierId },
        data: { isPrimary: false },
      });
    }
    return tx.supplierContact.create({
      data: {
        tenantId: tenant.id,
        supplierId,
        name,
        title,
        role,
        email,
        phone,
        notes,
        isPrimary,
      },
    });
  });

  return NextResponse.json({ contact });
}
