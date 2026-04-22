import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


type PatchWarehouseBody = {
  code?: string | null;
  name?: string;
  type?: "CFS" | "WAREHOUSE";
  addressLine1?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  isActive?: boolean;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const { id } = await context.params;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as PatchWarehouseBody;
  const patch: {
    code?: string | null;
    name?: string;
    type?: "CFS" | "WAREHOUSE";
    addressLine1?: string | null;
    city?: string | null;
    region?: string | null;
    countryCode?: string | null;
    isActive?: boolean;
  } = {};
  if (input.code !== undefined) patch.code = input.code?.trim() || null;
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return toApiErrorResponse({ error: "name cannot be empty.", code: "BAD_INPUT", status: 400 });
    patch.name = name;
  }
  if (input.type !== undefined) patch.type = input.type;
  if (input.addressLine1 !== undefined) patch.addressLine1 = input.addressLine1?.trim() || null;
  if (input.city !== undefined) patch.city = input.city?.trim() || null;
  if (input.region !== undefined) patch.region = input.region?.trim() || null;
  if (input.countryCode !== undefined) {
    patch.countryCode = input.countryCode?.trim().toUpperCase() || null;
  }
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  const row = await prisma.warehouse.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true },
  });
  if (!row) return toApiErrorResponse({ error: "Location not found.", code: "NOT_FOUND", status: 404 });
  try {
    await prisma.warehouse.update({ where: { id }, data: patch });
    return NextResponse.json({ ok: true });
  } catch {
    return toApiErrorResponse({ error: "Could not update location.", code: "BAD_INPUT", status: 400 });
  }
}
