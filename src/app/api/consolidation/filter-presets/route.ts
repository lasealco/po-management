import { NextResponse } from "next/server";
import { getActorUserId, requireApiGrant, userHasRoleNamed } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

type Preset = {
  id: string;
  name: string;
  supplierName: string | null;
  shippedFrom: string | null;
  shippedTo: string | null;
};

type SavePresetBody = Omit<Preset, "id">;

const PREF_KEY = "consolidation_filter_presets";

async function gate() {
  const gateResp = await requireApiGrant("org.orders", "view");
  if (gateResp) return gateResp;
  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }
  const isSupplier = await userHasRoleNamed(actorId, "Supplier portal");
  if (isSupplier) {
    return NextResponse.json(
      { error: "Supplier users cannot manage consolidation presets." },
      { status: 403 },
    );
  }
  return { tenant, actorId };
}

function readPresetArray(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v) => v && typeof v === "object")
    .map((v) => v as Preset)
    .filter((p) => typeof p.id === "string" && typeof p.name === "string");
}

export async function GET() {
  const access = await gate();
  if (access instanceof NextResponse) return access;
  const pref = await prisma.userPreference.findUnique({
    where: {
      userId_key: { userId: access.actorId, key: PREF_KEY },
    },
    select: { value: true },
  });
  return NextResponse.json({ presets: readPresetArray(pref?.value) });
}

export async function POST(request: Request) {
  const access = await gate();
  if (access instanceof NextResponse) return access;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as SavePresetBody;
  const name = (input.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const existing = await prisma.userPreference.findUnique({
    where: { userId_key: { userId: access.actorId, key: PREF_KEY } },
    select: { id: true, value: true },
  });
  const list = readPresetArray(existing?.value);
  const created: Preset = {
    id: crypto.randomUUID(),
    name,
    supplierName: input.supplierName?.trim() || null,
    shippedFrom: input.shippedFrom?.trim() || null,
    shippedTo: input.shippedTo?.trim() || null,
  };
  const next = [...list, created].slice(-20);

  if (existing) {
    await prisma.userPreference.update({
      where: { id: existing.id },
      data: { value: next },
    });
  } else {
    await prisma.userPreference.create({
      data: {
        tenantId: access.tenant.id,
        userId: access.actorId,
        key: PREF_KEY,
        value: next,
      },
    });
  }
  return NextResponse.json({ ok: true, preset: created });
}
