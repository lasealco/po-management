import { NextResponse } from "next/server";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }
  const categories = await prisma.productCategory.findMany({
    where: { tenantId: tenant.id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
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

  const code =
    typeof o.code === "string" && o.code.trim() ? o.code.trim() : null;
  const description =
    typeof o.description === "string" && o.description.trim()
      ? o.description.trim()
      : null;
  const sortOrder =
    typeof o.sortOrder === "number" && Number.isFinite(o.sortOrder)
      ? Math.floor(o.sortOrder)
      : 0;

  try {
    const category = await prisma.productCategory.create({
      data: {
        tenantId: tenant.id,
        name,
        code,
        description,
        sortOrder,
      },
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
