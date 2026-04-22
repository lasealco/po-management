import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { requireApiGrant } from "@/lib/authz";
import { isMacroRegion } from "@/lib/reference-data/macro-regions";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const gate = await requireApiGrant("org.settings", "view");
  if (gate) return gate;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const activeOnly = (url.searchParams.get("activeOnly") ?? "1") !== "0";
  const take = Math.min(500, Math.max(1, Number(url.searchParams.get("take") ?? "400") || 400));
  const where: Record<string, unknown> = {};
  if (activeOnly) where.isActive = true;
  if (q) {
    where.OR = [
      { isoAlpha2: { contains: q, mode: "insensitive" } },
      { isoAlpha3: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }
  const rows = await prisma.referenceCountry.findMany({
    where,
    orderBy: [{ isoAlpha2: "asc" }],
    take,
    select: {
      id: true,
      isoAlpha2: true,
      isoAlpha3: true,
      name: true,
      regionCode: true,
      isActive: true,
    },
  });
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  const isoAlpha2 = String(body.isoAlpha2 ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const isoAlpha3 = String(body.isoAlpha3 ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 3);
  const name = String(body.name ?? "").trim();
  if (isoAlpha2.length !== 2 || isoAlpha3.length !== 3 || !name) {
    return toApiErrorResponse({ error: "isoAlpha2 (2 chars), isoAlpha3 (3 chars), and name are required.", code: "BAD_INPUT", status: 400 });
  }
  const rc = typeof body.regionCode === "string" ? body.regionCode.trim() : "";
  let regionCode: string | null = null;
  if (rc) {
    if (!isMacroRegion(rc)) {
      return toApiErrorResponse({ error: "Invalid regionCode.", code: "BAD_INPUT", status: 400 });
    }
    if (rc !== "") regionCode = rc;
  }
  try {
    const row = await prisma.referenceCountry.create({
      data: {
        isoAlpha2,
        isoAlpha3,
        name,
        regionCode,
        isActive: true,
      },
      select: {
        id: true,
        isoAlpha2: true,
        isoAlpha3: true,
        name: true,
        regionCode: true,
        isActive: true,
      },
    });
    return NextResponse.json({ row });
  } catch {
    return toApiErrorResponse({ error: "Could not create country (duplicate ISO code or database error).", code: "CONFLICT", status: 409 });
  }
}
