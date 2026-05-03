import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { loadWmsViewReadScope } from "@/lib/wms/wms-read-scope";
import { gateWmsTierMutation } from "@/lib/wms/wms-mutation-grants";
import {
  executeVoicePickConfirmations,
  parseVoicePickPostBody,
  VOICE_PICK_SCHEMA_VERSION,
  voicePickConfirmToken,
  type VoicePickSessionPickV1,
} from "@/lib/wms/voice-pick-bf66";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireApiGrant("org.wms", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });
  }

  const viewScope = await loadWmsViewReadScope(tenant.id, actorId);
  const url = new URL(request.url);
  const warehouseId = url.searchParams.get("warehouseId")?.trim() || undefined;
  const waveId = url.searchParams.get("waveId")?.trim() || undefined;
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 50;

  if (warehouseId) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: warehouseId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!wh) {
      return toApiErrorResponse({ error: "Warehouse not found.", code: "NOT_FOUND", status: 404 });
    }
  }
  if (waveId) {
    const wv = await prisma.wmsWave.findFirst({
      where: { id: waveId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!wv) {
      return toApiErrorResponse({ error: "Wave not found.", code: "NOT_FOUND", status: 404 });
    }
  }

  const baseFilters: Prisma.WmsTaskWhereInput = {
    tenantId: tenant.id,
    taskType: "PICK",
    status: "OPEN",
    productId: { not: null },
    binId: { not: null },
    ...(warehouseId ? { warehouseId } : {}),
    ...(waveId ? { waveId } : {}),
  };

  const where: Prisma.WmsTaskWhereInput = {
    AND: [baseFilters, viewScope.wmsTask],
  };

  const tasks = await prisma.wmsTask.findMany({
    where,
    orderBy: [{ batchGroupKey: "asc" }, { bin: { code: "asc" } }, { id: "asc" }],
    take: limit,
    include: {
      product: { select: { id: true, sku: true, productCode: true, name: true } },
      bin: { select: { code: true, name: true } },
      warehouse: { select: { code: true, name: true } },
      wave: { select: { id: true, waveNo: true } },
    },
  });

  const lineIds = tasks
    .filter((t) => t.referenceType === "OUTBOUND_LINE_PICK" && t.referenceId)
    .map((t) => t.referenceId!);
  const lines =
    lineIds.length > 0
      ? await prisma.outboundOrderLine.findMany({
          where: { id: { in: lineIds }, tenantId: tenant.id },
          select: {
            id: true,
            lineNo: true,
            outboundOrderId: true,
            outboundOrder: { select: { id: true, outboundNo: true } },
          },
        })
      : [];
  const lineById = new Map(lines.map((l) => [l.id, l]));

  const picks: VoicePickSessionPickV1[] = tasks.map((t, idx) => {
    const line = t.referenceId ? lineById.get(t.referenceId) : undefined;
    const qtyNum = Number(t.quantity);
    const qtySpoken = Number.isFinite(qtyNum) ? qtyNum : 0;
    const token = t.product ? voicePickConfirmToken(t.product) : "";
    return {
      pickSeq: idx + 1,
      taskId: t.id,
      confirmSku: token,
      qtySpoken,
      qtyExpected: t.quantity.toString(),
      binCode: t.bin?.code ?? "",
      binName: t.bin?.name ?? "",
      warehouseCode: t.warehouse?.code ?? null,
      warehouseName: t.warehouse?.name ?? "",
      productName: t.product?.name ?? "",
      lotCode: t.lotCode,
      waveId: t.waveId,
      waveNo: t.wave?.waveNo ?? null,
      outboundOrderId: line?.outboundOrderId ?? null,
      outboundOrderNo: line?.outboundOrder?.outboundNo ?? null,
      outboundLineNo: line?.lineNo ?? null,
    };
  });

  return NextResponse.json({
    schemaVersion: VOICE_PICK_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    filters: { warehouseId: warehouseId ?? null, waveId: waveId ?? null, limit },
    picks,
  });
}

export async function POST(request: Request) {
  const gateView = await requireApiGrant("org.wms", "view");
  if (gateView) return gateView;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active actor.", code: "FORBIDDEN", status: 403 });
  }

  const tierGate = await gateWmsTierMutation(actorId, "operations");
  if (tierGate) return tierGate;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = parseVoicePickPostBody(body);
  if (!parsed.ok) {
    return toApiErrorResponse({ error: parsed.message, code: "VALIDATION_ERROR", status: 400 });
  }

  const result = await executeVoicePickConfirmations(tenant.id, actorId, parsed.picks);
  if (!result.ok) {
    return toApiErrorResponse({
      error: result.message,
      code: "VOICE_PICK_ERROR",
      status: result.status,
    });
  }

  return NextResponse.json({ ok: true, completedTaskIds: result.completedTaskIds });
}
