import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


const PREF_KEY = "consolidation_filter_presets";

type Preset = {
  id: string;
  name: string;
  supplierName: string | null;
  shippedFrom: string | null;
  shippedTo: string | null;
};

function readPresetArray(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v) => v && typeof v === "object")
    .map((v) => v as Preset)
    .filter((p) => typeof p.id === "string" && typeof p.name === "string");
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gateResp = await requireApiGrant("org.orders", "view");
  if (gateResp) return gateResp;
  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }
  const { id } = await context.params;
  const existing = await prisma.userPreference.findUnique({
    where: { userId_key: { userId: actorId, key: PREF_KEY } },
    select: { id: true, value: true },
  });
  if (!existing) return NextResponse.json({ ok: true });
  const next = readPresetArray(existing.value).filter((p) => p.id !== id);
  await prisma.userPreference.update({
    where: { id: existing.id },
    data: { value: next },
  });
  return NextResponse.json({ ok: true });
}
