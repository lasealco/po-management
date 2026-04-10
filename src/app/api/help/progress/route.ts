import { NextResponse } from "next/server";
import { getActorUserId } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

const PREF_KEY = "help_guide_progress";

type ProgressPayload = {
  playbookId?: string | null;
  stepIdx?: number | null;
};

export async function GET() {
  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active session." }, { status: 403 });
  }
  const pref = await prisma.userPreference.findUnique({
    where: { userId_key: { userId: actorId, key: PREF_KEY } },
    select: { value: true },
  });
  return NextResponse.json({
    progress: pref?.value ?? null,
  });
}

export async function PATCH(request: Request) {
  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active session." }, { status: 403 });
  }
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as ProgressPayload;
  if (!input.playbookId || input.stepIdx == null || !Number.isFinite(input.stepIdx)) {
    return NextResponse.json(
      { error: "playbookId and stepIdx are required." },
      { status: 400 },
    );
  }
  const payload = {
    playbookId: input.playbookId,
    stepIdx: Math.max(0, Math.floor(input.stepIdx)),
  };
  await prisma.userPreference.upsert({
    where: { userId_key: { userId: actorId, key: PREF_KEY } },
    update: { value: payload },
    create: {
      tenantId: tenant.id,
      userId: actorId,
      key: PREF_KEY,
      value: payload,
    },
  });
  return NextResponse.json({ ok: true });
}
