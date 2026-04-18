import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

const MODES = new Set(["OCEAN", "AIR", "ROAD", "RAIL"]);

function parseModePatch(v: unknown): string | null | "__invalid__" {
  if (v === null || v === "") return null;
  if (typeof v !== "string") return "__invalid__";
  const u = v.trim().toUpperCase();
  if (!MODES.has(u)) return "__invalid__";
  return u;
}

function str(
  v: unknown,
  max: number,
  required: boolean,
): string | "__invalid__" | null | undefined {
  if (v === undefined) return undefined;
  if (v == null) return required ? "__invalid__" : null;
  if (typeof v !== "string") return "__invalid__";
  const t = v.trim();
  if (!t) return required ? "__invalid__" : null;
  if (t.length > max) return "__invalid__";
  return t;
}

async function getCapOr404(supplierId: string, capId: string, tenantId: string) {
  return prisma.supplierServiceCapability.findFirst({
    where: { id: capId, supplierId, tenantId },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; capId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, capId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await getCapOr404(supplierId, capId, tenant.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const data: {
    mode?: string | null;
    subMode?: string | null;
    serviceType?: string;
    geography?: string | null;
    notes?: string | null;
  } = {};

  if (o.mode !== undefined) {
    const mode = parseModePatch(o.mode);
    if (mode === "__invalid__") {
      return NextResponse.json(
        { error: "mode must be OCEAN, AIR, ROAD, RAIL, or empty." },
        { status: 400 },
      );
    }
    data.mode = mode;
  }
  if (o.subMode !== undefined) {
    const s = str(o.subMode, 64, false);
    if (s === "__invalid__") return NextResponse.json({ error: "Invalid subMode." }, { status: 400 });
    data.subMode = s;
  }
  if (o.serviceType !== undefined) {
    const s = str(o.serviceType, 128, true);
    if (s === "__invalid__" || s == null) {
      return NextResponse.json({ error: "serviceType invalid." }, { status: 400 });
    }
    data.serviceType = s;
  }
  if (o.geography !== undefined) {
    const s = str(o.geography, 256, false);
    if (s === "__invalid__") return NextResponse.json({ error: "Invalid geography." }, { status: 400 });
    data.geography = s;
  }
  if (o.notes !== undefined) {
    if (o.notes === null) data.notes = null;
    else if (typeof o.notes === "string") {
      const t = o.notes.trim();
      data.notes = t ? t.slice(0, 8000) : null;
    } else {
      return NextResponse.json({ error: "Invalid notes." }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const row = await prisma.supplierServiceCapability.update({
    where: { id: capId },
    data,
  });

  return NextResponse.json({
    capability: {
      id: row.id,
      mode: row.mode,
      subMode: row.subMode,
      serviceType: row.serviceType,
      geography: row.geography,
      notes: row.notes,
    },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; capId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId, capId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const existing = await getCapOr404(supplierId, capId, tenant.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.supplierServiceCapability.delete({ where: { id: capId } });
  return NextResponse.json({ ok: true });
}
