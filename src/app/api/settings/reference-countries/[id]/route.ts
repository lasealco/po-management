import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { isMacroRegion } from "@/lib/reference-data/macro-regions";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });

  const data: { name?: string; isActive?: boolean; regionCode?: string | null } = {};
  if (typeof body.name === "string") data.name = body.name.trim() || undefined;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if ("regionCode" in body) {
    const rc = typeof body.regionCode === "string" ? body.regionCode.trim() : "";
    if (rc === "") data.regionCode = null;
    else if (isMacroRegion(rc) && rc !== "") data.regionCode = rc;
    else if (rc !== "") {
      return NextResponse.json({ error: "Invalid regionCode." }, { status: 400 });
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  try {
    const row = await prisma.referenceCountry.update({
      where: { id },
      data,
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
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
