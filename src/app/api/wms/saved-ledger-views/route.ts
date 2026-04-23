import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  normalizeWmsSavedLedgerFilters,
  parseWmsSavedLedgerName,
  wmsSavedLedgerFiltersToPrismaJson,
  wmsSavedLedgerRowToClient,
} from "@/lib/wms/saved-ledger-filters";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const rows = await prisma.wmsSavedLedgerView.findMany({
    where: { tenantId: tenant.id, userId: actorId },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ items: rows.map(wmsSavedLedgerRowToClient) });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.wms", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }
  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected JSON object.", code: "BAD_INPUT", status: 400 });
  }
  const rec = body as Record<string, unknown>;

  const warehouses = await prisma.warehouse.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
  });
  const whSet = new Set(warehouses.map((w) => w.id));

  try {
    const name = parseWmsSavedLedgerName(rec.name);
    const filters = normalizeWmsSavedLedgerFilters(rec.filters, whSet);
    const row = await prisma.wmsSavedLedgerView.create({
      data: {
        tenantId: tenant.id,
        userId: actorId,
        name,
        filtersJson: wmsSavedLedgerFiltersToPrismaJson(filters),
      },
    });
    return NextResponse.json({ item: wmsSavedLedgerRowToClient(row) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid request.";
    return toApiErrorResponse({ error: msg, code: "BAD_INPUT", status: 400 });
  }
}
