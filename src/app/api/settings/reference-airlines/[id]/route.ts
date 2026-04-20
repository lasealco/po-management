import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });

  const data: {
    name?: string;
    notes?: string | null;
    isActive?: boolean;
    awbPrefix3?: string;
    icaoCode?: string | null;
  } = {};
  if (typeof body.name === "string") data.name = body.name.trim() || undefined;
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.awbPrefix3 === "string") {
    const d = body.awbPrefix3.replace(/\D/g, "");
    if (d.length > 0) data.awbPrefix3 = d.padStart(3, "0").slice(-3);
  }
  if ("icaoCode" in body) {
    const raw = body.icaoCode;
    if (raw == null || raw === "") data.icaoCode = null;
    else {
      const s = String(raw)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 3);
      data.icaoCode = s.length === 3 ? s : null;
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  try {
    const row = await prisma.referenceAirline.update({
      where: { id },
      data,
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
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
