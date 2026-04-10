import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

type CreateWarehouseBody = {
  code?: string | null;
  name?: string;
  type?: "CFS" | "WAREHOUSE";
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
};

export async function GET() {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  const warehouses = await prisma.warehouse.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ warehouses });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as CreateWarehouseBody;
  const name = input.name?.trim() ?? "";
  if (!name) return NextResponse.json({ error: "name is required." }, { status: 400 });
  try {
    const row = await prisma.warehouse.create({
      data: {
        tenantId: tenant.id,
        code: input.code?.trim() || null,
        name,
        type: input.type === "WAREHOUSE" ? "WAREHOUSE" : "CFS",
        city: input.city?.trim() || null,
        region: input.region?.trim() || null,
        countryCode: input.countryCode?.trim().toUpperCase() || null,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch {
    return NextResponse.json(
      { error: "Could not create location (code may already exist)." },
      { status: 400 },
    );
  }
}
