import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import {
  inboundAsnAdviseLinesToPrismaJson,
  parseInboundAsnAdviseLines,
} from "@/lib/wms/inbound-asn-advise";
import { gateWmsTierMutation } from "@/lib/wms/wms-mutation-grants";

export const dynamic = "force-dynamic";

type PostBody = {
  externalAsnId?: string;
  warehouseId?: string | null;
  purchaseOrderId?: string | null;
  shipmentId?: string | null;
  asnReference?: string | null;
  expectedReceiveAt?: string | null;
  lines?: unknown;
  rawPayload?: unknown;
};

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const url = new URL(request.url);
  const takeRaw = Number(url.searchParams.get("limit") ?? "40");
  const take = Number.isFinite(takeRaw) ? Math.min(200, Math.max(1, Math.floor(takeRaw))) : 40;

  const rows = await prisma.wmsInboundAsnAdvise.findMany({
    where: { tenantId: tenant.id },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      externalAsnId: true,
      asnReference: true,
      expectedReceiveAt: true,
      linesJson: true,
      shipmentId: true,
      purchaseOrderId: true,
      warehouseId: true,
      createdAt: true,
      updatedAt: true,
      warehouse: { select: { id: true, code: true, name: true } },
      purchaseOrder: { select: { id: true, orderNumber: true } },
      shipment: { select: { id: true, shipmentNo: true } },
    },
  });

  return NextResponse.json({ ok: true, advises: rows });
}

export async function POST(request: Request) {
  const gateView = await requireApiGrant("org.wms", "view");
  if (gateView) return gateView;

  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const actorId = await getActorUserId();
  if (!actorId) return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });

  const tierGate = await gateWmsTierMutation(actorId, "operations");
  if (tierGate) return tierGate;

  let body: PostBody = {};
  try {
    body = (await request.json()) as PostBody;
  } catch {
    body = {};
  }

  const externalAsnId = body.externalAsnId?.trim() ?? "";
  if (!externalAsnId) {
    return toApiErrorResponse({ error: "externalAsnId is required.", code: "VALIDATION_ERROR", status: 400 });
  }
  if (externalAsnId.length > 256) {
    return toApiErrorResponse({
      error: "externalAsnId must be at most 256 characters.",
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  const parsed = parseInboundAsnAdviseLines(body.lines);
  if (!parsed.ok) {
    return toApiErrorResponse({ error: parsed.error, code: "VALIDATION_ERROR", status: 400 });
  }

  const linesJson = inboundAsnAdviseLinesToPrismaJson(parsed.lines);
  let rawPayloadJson: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined = undefined;
  if (body.rawPayload !== undefined) {
    rawPayloadJson =
      body.rawPayload === null ? Prisma.JsonNull : (body.rawPayload as Prisma.InputJsonValue);
  }

  const asnReference = body.asnReference?.trim().slice(0, 256) || null;

  let expectedReceiveAt: Date | null = null;
  if (body.expectedReceiveAt?.trim()) {
    const d = new Date(body.expectedReceiveAt.trim());
    if (!Number.isFinite(d.getTime())) {
      return toApiErrorResponse({
        error: "expectedReceiveAt must be a valid ISO datetime when provided.",
        code: "VALIDATION_ERROR",
        status: 400,
      });
    }
    expectedReceiveAt = d;
  }

  const warehouseId = body.warehouseId?.trim() || null;
  if (warehouseId) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!wh) {
      return toApiErrorResponse({ error: "warehouseId not found for tenant.", code: "NOT_FOUND", status: 404 });
    }
  }

  const purchaseOrderId = body.purchaseOrderId?.trim() || null;
  if (purchaseOrderId) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!po) {
      return toApiErrorResponse({
        error: "purchaseOrderId not found for tenant.",
        code: "NOT_FOUND",
        status: 404,
      });
    }
  }

  const shipmentId = body.shipmentId?.trim() || null;
  if (shipmentId) {
    const sh = await prisma.shipment.findFirst({
      where: { id: shipmentId, order: { tenantId: tenant.id } },
      select: { id: true },
    });
    if (!sh) {
      return toApiErrorResponse({ error: "shipmentId not found for tenant.", code: "NOT_FOUND", status: 404 });
    }
  }

  const prior = await prisma.wmsInboundAsnAdvise.findUnique({
    where: { tenantId_externalAsnId: { tenantId: tenant.id, externalAsnId } },
    select: { id: true },
  });

  const row = await prisma.wmsInboundAsnAdvise.upsert({
    where: { tenantId_externalAsnId: { tenantId: tenant.id, externalAsnId } },
    create: {
      tenantId: tenant.id,
      externalAsnId,
      warehouseId,
      purchaseOrderId,
      shipmentId,
      asnReference,
      expectedReceiveAt,
      linesJson,
      createdById: actorId,
      ...(rawPayloadJson !== undefined ? { rawPayloadJson } : {}),
    },
    update: {
      warehouseId,
      purchaseOrderId,
      shipmentId,
      asnReference,
      expectedReceiveAt,
      linesJson,
      ...(rawPayloadJson !== undefined ? { rawPayloadJson } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    id: row.id,
    externalAsnId: row.externalAsnId,
    updated: prior !== null,
  });
}
