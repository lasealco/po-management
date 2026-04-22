import { NextResponse } from "next/server";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


import { getActorUserId, getViewerGrantSet } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

const PREF_KEY = "reporting.cockpitLayout";

export const dynamic = "force-dynamic";

export async function GET() {
  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  const access = await getViewerGrantSet();
  if (!tenant || !actorId || !access?.user) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  const pref = await prisma.userPreference.findUnique({
    where: { userId_key: { userId: actorId, key: PREF_KEY } },
    select: { value: true },
  });
  return NextResponse.json({ layout: pref?.value ?? null });
}

export async function PATCH(request: Request) {
  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  const access = await getViewerGrantSet();
  if (!tenant || !actorId || !access?.user) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const layout = Array.isArray(obj.layout) ? obj.layout : null;
  if (!layout) return toApiErrorResponse({ error: "layout array is required.", code: "BAD_INPUT", status: 400 });

  await prisma.userPreference.upsert({
    where: { userId_key: { userId: actorId, key: PREF_KEY } },
    create: { tenantId: tenant.id, userId: actorId, key: PREF_KEY, value: layout },
    update: { value: layout },
  });
  return NextResponse.json({ ok: true });
}
