import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { importLocationCodesFromWeb } from "@/lib/location-codes/importer";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const gate = await requireApiGrant("org.settings", "view");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const type = (url.searchParams.get("type") ?? "").trim().toUpperCase();
  const activeOnly = (url.searchParams.get("activeOnly") ?? "1") !== "0";
  const where: Record<string, unknown> = { tenantId: tenant.id };
  if (q) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }
  if (type === "UN_LOCODE" || type === "PORT" || type === "AIRPORT") where.type = type;
  if (activeOnly) where.isActive = true;
  const rows = await prisma.locationCode.findMany({
    where,
    orderBy: [{ type: "asc" }, { code: "asc" }],
    take: 300,
    select: { id: true, type: true, code: true, name: true, countryCode: true, isActive: true, source: true },
  });
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  const action = typeof body.action === "string" ? body.action : "create";

  if (action === "import_web") {
    const result = await importLocationCodesFromWeb(prisma, tenant.id);
    return NextResponse.json({ ok: true, result });
  }

  const type = String(body.type ?? "").trim().toUpperCase();
  const code = String(body.code ?? "").trim().toUpperCase();
  const name = String(body.name ?? "").trim();
  if (!name || !code) return toApiErrorResponse({ error: "type, code, and name are required.", code: "BAD_INPUT", status: 400 });
  if (type !== "UN_LOCODE" && type !== "PORT" && type !== "AIRPORT") {
    return toApiErrorResponse({ error: "Invalid type.", code: "BAD_INPUT", status: 400 });
  }
  const row = await prisma.locationCode.upsert({
    where: { tenantId_type_code: { tenantId: tenant.id, type: type as "UN_LOCODE" | "PORT" | "AIRPORT", code } },
    update: {
      name,
      countryCode: String(body.countryCode ?? "").trim().toUpperCase().slice(0, 2) || null,
      subdivision: String(body.subdivision ?? "").trim() || null,
      source: "manual",
      isActive: true,
    },
    create: {
      tenantId: tenant.id,
      type: type as "UN_LOCODE" | "PORT" | "AIRPORT",
      code,
      name,
      countryCode: String(body.countryCode ?? "").trim().toUpperCase().slice(0, 2) || null,
      subdivision: String(body.subdivision ?? "").trim() || null,
      source: "manual",
      isActive: true,
    },
  });
  return NextResponse.json({ row });
}
