import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const rawTypes = (url.searchParams.get("types") ?? "").trim();
  const types = rawTypes
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s === "UN_LOCODE" || s === "PORT" || s === "AIRPORT") as Array<"UN_LOCODE" | "PORT" | "AIRPORT">;

  if (q.length < 2) return NextResponse.json({ rows: [] });
  const rows = await prisma.locationCode.findMany({
    where: {
      tenantId: tenant.id,
      isActive: true,
      ...(types.length > 0 ? { type: { in: types } } : {}),
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ type: "asc" }, { code: "asc" }],
    take: 30,
    select: { id: true, type: true, code: true, name: true, countryCode: true },
  });

  return NextResponse.json({ rows });
}
