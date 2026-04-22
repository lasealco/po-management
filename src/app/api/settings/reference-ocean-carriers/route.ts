import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { requireApiGrant } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

function normalizeScac(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

export async function GET(req: Request) {
  const gate = await requireApiGrant("org.settings", "view");
  if (gate) return gate;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const activeOnly = (url.searchParams.get("activeOnly") ?? "1") !== "0";
  const where: Record<string, unknown> = {};
  if (activeOnly) where.isActive = true;
  if (q) {
    where.OR = [
      { scac: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }
  const rows = await prisma.referenceOceanCarrier.findMany({
    where,
    orderBy: [{ scac: "asc" }],
    take: 300,
    select: { id: true, scac: true, name: true, notes: true, isActive: true },
  });
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  const scac = normalizeScac(String(body.scac ?? ""));
  const name = String(body.name ?? "").trim();
  if (scac.length < 2 || !name) {
    return toApiErrorResponse({ error: "scac (2–4 characters) and name are required.", code: "BAD_INPUT", status: 400 });
  }
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  try {
    const row = await prisma.referenceOceanCarrier.create({
      data: { scac, name, notes, isActive: true },
      select: { id: true, scac: true, name: true, notes: true, isActive: true },
    });
    return NextResponse.json({ row });
  } catch {
    return toApiErrorResponse({ error: "Could not create carrier (duplicate SCAC?).", code: "CONFLICT", status: 409 });
  }
}
