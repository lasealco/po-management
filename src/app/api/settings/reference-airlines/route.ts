import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { requireApiGrant } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

function normalizeIata(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);
}

function normalizeIcao(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const s = String(raw)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
  return s.length === 3 ? s : null;
}

function normalizeAwbPrefix(raw: unknown): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 0) return null;
  return d.padStart(3, "0").slice(-3);
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
      { iataCode: { contains: q, mode: "insensitive" } },
      { icaoCode: { contains: q, mode: "insensitive" } },
      { awbPrefix3: { contains: q } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }
  const rows = await prisma.referenceAirline.findMany({
    where,
    orderBy: [{ iataCode: "asc" }],
    take: 300,
    select: {
      id: true,
      iataCode: true,
      icaoCode: true,
      awbPrefix3: true,
      name: true,
      notes: true,
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
  const iataCode = normalizeIata(String(body.iataCode ?? ""));
  const name = String(body.name ?? "").trim();
  const awbPrefix3 = normalizeAwbPrefix(body.awbPrefix3);
  if (iataCode.length < 2 || !name || !awbPrefix3) {
    return toApiErrorResponse({ error: "iataCode (2–3 chars), name, and awbPrefix3 (3 digits) are required.", code: "BAD_INPUT", status: 400 });
  }
  const icaoCode = normalizeIcao(body.icaoCode);
  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  try {
    const row = await prisma.referenceAirline.create({
      data: { iataCode, icaoCode, awbPrefix3, name, notes, isActive: true },
      select: {
        id: true,
        iataCode: true,
        icaoCode: true,
        awbPrefix3: true,
        name: true,
        notes: true,
        isActive: true,
      },
    });
    return NextResponse.json({ row });
  } catch {
    return toApiErrorResponse({ error: "Could not create airline (duplicate IATA / ICAO?).", code: "CONFLICT", status: 409 });
  }
}
