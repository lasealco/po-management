import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;

  const { id } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await prisma.productCategory.findFirst({
    where: { id, tenantId: tenant.id },
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
  const o = body as Record<string, unknown>;

  const data: {
    name?: string;
    code?: string | null;
    description?: string | null;
    sortOrder?: number;
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
  if (o.description !== undefined) {
    data.description =
      typeof o.description === "string" && o.description.trim()
        ? o.description.trim()
        : null;
  }
  if (o.sortOrder !== undefined) {
    if (typeof o.sortOrder !== "number" || !Number.isFinite(o.sortOrder)) {
      return NextResponse.json({ error: "Invalid sortOrder." }, { status: 400 });
    }
    data.sortOrder = Math.floor(o.sortOrder);
  }

  try {
    const category = await prisma.productCategory.update({
      where: { id },
      data,
    });
    return NextResponse.json({ category });
  } catch (e: unknown) {
    const c =
      typeof e === "object" && e !== null && "code" in e
        ? (e as { code: string }).code
        : null;
    if (c === "P2002") {
      return NextResponse.json(
        { error: "Category name must be unique per tenant." },
        { status: 409 },
      );
    }
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;

  const { id } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await prisma.productCategory.findFirst({
    where: { id, tenantId: tenant.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.productCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
