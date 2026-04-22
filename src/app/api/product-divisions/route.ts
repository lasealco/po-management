import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


export async function GET() {
  const gate = await requireApiGrant("org.settings", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const divisions = await prisma.productDivision.findMany({
    where: { tenantId: tenant.id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ divisions });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object.", code: "BAD_INPUT", status: 400 });
  }
  const o = body as Record<string, unknown>;
  const name =
    typeof o.name === "string" && o.name.trim() ? o.name.trim() : null;
  if (!name) {
    return toApiErrorResponse({ error: "name is required.", code: "BAD_INPUT", status: 400 });
  }

  const code =
    typeof o.code === "string" && o.code.trim() ? o.code.trim() : null;
  const sortOrder =
    typeof o.sortOrder === "number" && Number.isFinite(o.sortOrder)
      ? Math.floor(o.sortOrder)
      : 0;

  try {
    const division = await prisma.productDivision.create({
      data: {
        tenantId: tenant.id,
        name,
        code,
        sortOrder,
      },
    });
    return NextResponse.json({ division });
  } catch (e: unknown) {
    const c =
      typeof e === "object" && e !== null && "code" in e
        ? (e as { code: string }).code
        : null;
    if (c === "P2002") {
      return toApiErrorResponse({ error: "Division name must be unique per tenant.", code: "CONFLICT", status: 409 });
    }
    throw e;
  }
}
