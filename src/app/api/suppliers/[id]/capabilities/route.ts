import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


const MODES = new Set(["", "OCEAN", "AIR", "ROAD", "RAIL"]);

function normMode(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return "__invalid__";
  const u = v.trim().toUpperCase();
  if (!MODES.has(u)) return "__invalid__";
  return u === "" ? null : u;
}

function str(v: unknown, max: number, required: boolean): string | "__invalid__" | null {
  if (v == null) return required ? "__invalid__" : null;
  if (typeof v !== "string") return "__invalid__";
  const t = v.trim();
  if (!t) return required ? "__invalid__" : null;
  if (t.length > max) return "__invalid__";
  return t;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const { id: supplierId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!supplier) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected object.", code: "BAD_INPUT", status: 400 });
  }

  const o = body as Record<string, unknown>;
  const mode = normMode(o.mode);
  if (mode === "__invalid__") {
    return toApiErrorResponse({ error: "mode must be OCEAN, AIR, ROAD, RAIL, or empty.", code: "BAD_INPUT", status: 400 });
  }
  const subMode = str(o.subMode, 64, false);
  if (subMode === "__invalid__") {
    return toApiErrorResponse({ error: "Invalid subMode.", code: "BAD_INPUT", status: 400 });
  }
  const serviceType = str(o.serviceType, 128, true);
  if (serviceType === "__invalid__" || serviceType == null) {
    return toApiErrorResponse({ error: "serviceType is required (max 128 chars).", code: "BAD_INPUT", status: 400 });
  }
  const geography = str(o.geography, 256, false);
  if (geography === "__invalid__") {
    return toApiErrorResponse({ error: "Invalid geography.", code: "BAD_INPUT", status: 400 });
  }
  const notes = typeof o.notes === "string" ? (o.notes.trim() ? o.notes.trim().slice(0, 8000) : null) : null;

  const row = await prisma.supplierServiceCapability.create({
    data: {
      tenantId: tenant.id,
      supplierId,
      mode,
      subMode,
      serviceType,
      geography,
      notes,
    },
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
