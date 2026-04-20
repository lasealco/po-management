import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });

  const data: { name?: string; notes?: string | null; isActive?: boolean } = {};
  if (typeof body.name === "string") data.name = body.name.trim() || undefined;
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  try {
    const row = await prisma.referenceOceanCarrier.update({
      where: { id },
      data,
      select: { id: true, scac: true, name: true, notes: true, isActive: true },
    });
    return NextResponse.json({ row });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
