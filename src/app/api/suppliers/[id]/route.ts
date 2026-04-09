import { NextResponse } from "next/server";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      offices: { orderBy: { name: "asc" } },
      _count: { select: { productSuppliers: true, orders: true } },
    },
  });

  if (!supplier) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ supplier });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object." }, { status: 400 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const o = body as Record<string, unknown>;
  const data: {
    name?: string;
    code?: string | null;
    email?: string | null;
    phone?: string | null;
    isActive?: boolean;
  } = {};

  if (o.name !== undefined) {
    if (typeof o.name !== "string" || !o.name.trim()) {
      return NextResponse.json({ error: "Invalid name." }, { status: 400 });
    }
    data.name = o.name.trim();
  }
  if (o.code !== undefined) {
    data.code =
      typeof o.code === "string" && o.code.trim() ? o.code.trim() : null;
  }
  if (o.email !== undefined) {
    data.email =
      typeof o.email === "string" && o.email.trim() ? o.email.trim() : null;
  }
  if (o.phone !== undefined) {
    data.phone =
      typeof o.phone === "string" && o.phone.trim() ? o.phone.trim() : null;
  }
  if (o.isActive !== undefined) {
    data.isActive = Boolean(o.isActive);
  }

  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        code: true,
        email: true,
        phone: true,
        isActive: true,
      },
    });
    return NextResponse.json({ supplier });
  } catch (e: unknown) {
    const codeErr =
      typeof e === "object" && e !== null && "code" in e
        ? (e as { code: string }).code
        : null;
    if (codeErr === "P2002") {
      return NextResponse.json(
        { error: "Supplier code must be unique per tenant." },
        { status: 409 },
      );
    }
    throw e;
  }
}
