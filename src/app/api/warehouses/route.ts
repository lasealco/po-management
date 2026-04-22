import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


type CreateWarehouseBody = {
  code?: string | null;
  name?: string;
  type?: "CFS" | "WAREHOUSE";
  addressLine1?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
};

export async function GET() {
  const gate = await requireApiGrant("org.orders", "view");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
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
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as CreateWarehouseBody;
  const name = input.name?.trim() ?? "";
  if (!name) return toApiErrorResponse({ error: "name is required.", code: "BAD_INPUT", status: 400 });
  try {
    const row = await prisma.warehouse.create({
      data: {
        tenantId: tenant.id,
        code: input.code?.trim() || null,
        name,
        type: input.type === "WAREHOUSE" ? "WAREHOUSE" : "CFS",
        addressLine1: input.addressLine1?.trim() || null,
        city: input.city?.trim() || null,
        region: input.region?.trim() || null,
        countryCode: input.countryCode?.trim().toUpperCase() || null,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch {
    return toApiErrorResponse({ error: "Could not create location (code may already exist).", code: "BAD_INPUT", status: 400 });
  }
}
