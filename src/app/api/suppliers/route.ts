import { NextResponse } from "next/server";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const suppliers = await prisma.supplier.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { offices: true, productSuppliers: true } },
    },
  });

  return NextResponse.json({ suppliers });
}

export async function POST(request: Request) {
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
  const email =
    typeof o.email === "string" && o.email.trim() ? o.email.trim() : null;
  const phone =
    typeof o.phone === "string" && o.phone.trim() ? o.phone.trim() : null;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  try {
    const supplier = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name,
        code,
        email,
        phone,
      },
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
