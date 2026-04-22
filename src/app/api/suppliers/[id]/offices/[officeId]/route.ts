import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


function optString(o: Record<string, unknown>, k: string) {
  if (o[k] === undefined) return undefined;
  if (typeof o[k] !== "string") return undefined;
  const t = (o[k] as string).trim();
  return t.length ? t : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; officeId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, officeId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object.", code: "BAD_INPUT", status: 400 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const office = await prisma.supplierOffice.findFirst({
    where: { id: officeId, supplierId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!office) {
    return toApiErrorResponse({ error: "Office not found.", code: "NOT_FOUND", status: 404 });
  }

  const o = body as Record<string, unknown>;

  const data: {
    name?: string;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    countryCode?: string | null;
    isActive?: boolean;
  } = {};

  if (o.name !== undefined) {
    if (typeof o.name !== "string" || !o.name.trim()) {
      return toApiErrorResponse({ error: "Invalid name.", code: "BAD_INPUT", status: 400 });
    }
    data.name = o.name.trim();
  }
  const a1 = optString(o, "addressLine1");
  if (a1 !== undefined) data.addressLine1 = a1;
  const a2 = optString(o, "addressLine2");
  if (a2 !== undefined) data.addressLine2 = a2;
  const city = optString(o, "city");
  if (city !== undefined) data.city = city;
  const region = optString(o, "region");
  if (region !== undefined) data.region = region;
  const postalCode = optString(o, "postalCode");
  if (postalCode !== undefined) data.postalCode = postalCode;
  const countryCode = optString(o, "countryCode");
  if (countryCode !== undefined) data.countryCode = countryCode;
  if (o.isActive !== undefined) data.isActive = Boolean(o.isActive);

  try {
    const updated = await prisma.supplierOffice.update({
      where: { id: officeId },
      data,
    });
    return NextResponse.json({ office: updated });
  } catch (e: unknown) {
    const codeErr =
      typeof e === "object" && e !== null && "code" in e
        ? (e as { code: string }).code
        : null;
    if (codeErr === "P2002") {
      return toApiErrorResponse({ error: "Office name must be unique per supplier.", code: "CONFLICT", status: 409 });
    }
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; officeId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, officeId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const office = await prisma.supplierOffice.findFirst({
    where: { id: officeId, supplierId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!office) {
    return toApiErrorResponse({ error: "Office not found.", code: "NOT_FOUND", status: 404 });
  }

  await prisma.supplierOffice.delete({ where: { id: officeId } });
  return NextResponse.json({ ok: true });
}
