import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { requireApiGrant } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });

  const data: { name?: string; notes?: string | null; isActive?: boolean } = {};
  if (typeof body.name === "string") data.name = body.name.trim() || undefined;
  if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (Object.keys(data).length === 0) {
    return toApiErrorResponse({ error: "No fields to update.", code: "BAD_INPUT", status: 400 });
  }

  try {
    const row = await prisma.referenceOceanCarrier.update({
      where: { id },
      data,
      select: { id: true, scac: true, name: true, notes: true, isActive: true },
    });
    return NextResponse.json({ row });
  } catch {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }
}
