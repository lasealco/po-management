import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId } = await context.params;

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

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!supplier) {
    return toApiErrorResponse({ error: "Supplier not found.", code: "NOT_FOUND", status: 404 });
  }

  const o = body as Record<string, unknown>;
  const name =
    typeof o.name === "string" && o.name.trim() ? o.name.trim() : null;
  if (!name) {
    return toApiErrorResponse({ error: "Office name is required.", code: "BAD_INPUT", status: 400 });
  }

  const opt = (k: string) =>
    typeof o[k] === "string" && (o[k] as string).trim()
      ? (o[k] as string).trim()
      : null;

  try {
    const office = await prisma.supplierOffice.create({
      data: {
        tenantId: tenant.id,
        supplierId,
        name,
        addressLine1: opt("addressLine1"),
        addressLine2: opt("addressLine2"),
        city: opt("city"),
        region: opt("region"),
        postalCode: opt("postalCode"),
        countryCode: opt("countryCode"),
      },
    });
    return NextResponse.json({ office });
  } catch (e: unknown) {
    const codeErr =
      typeof e === "object" && e !== null && "code" in e
        ? (e as { code: string }).code
        : null;
    if (codeErr === "P2002") {
      return toApiErrorResponse({ error: "An office with this name already exists for the supplier.", code: "CONFLICT", status: 409 });
    }
    throw e;
  }
}
