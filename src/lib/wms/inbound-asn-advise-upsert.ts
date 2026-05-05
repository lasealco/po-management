import { Prisma, type PrismaClient } from "@prisma/client";

export type UpsertInboundAsnAdviseParams = {
  tenantId: string;
  actorId: string;
  externalAsnId: string;
  linesJson: Prisma.InputJsonValue;
  asnPartnerId?: string | null;
  asnReference?: string | null;
  expectedReceiveAt?: Date | null;
  warehouseId?: string | null;
  purchaseOrderId?: string | null;
  shipmentId?: string | null;
  rawPayloadJson?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
};

export type UpsertInboundAsnAdviseError = { error: string; code: string; status: number };

export type UpsertInboundAsnAdviseResult =
  | { ok: true; row: { id: string; externalAsnId: string }; updated: boolean }
  | { ok: false; err: UpsertInboundAsnAdviseError };

/**
 * Validates FKs and upserts **`WmsInboundAsnAdvise`** (BF-59 / BF-75).
 */
export async function upsertInboundAsnAdviseRow(
  prisma: PrismaClient,
  params: UpsertInboundAsnAdviseParams,
): Promise<UpsertInboundAsnAdviseResult> {
  const {
    tenantId,
    actorId,
    externalAsnId,
    linesJson,
    asnReference,
    expectedReceiveAt,
    warehouseId,
    purchaseOrderId,
    shipmentId,
    rawPayloadJson,
  } = params;

  const warehouseIdNorm = warehouseId?.trim() || null;
  if (warehouseIdNorm) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: warehouseIdNorm, tenantId },
      select: { id: true },
    });
    if (!wh) {
      return {
        ok: false,
        err: { error: "warehouseId not found for tenant.", code: "NOT_FOUND", status: 404 },
      };
    }
  }

  const purchaseOrderIdNorm = purchaseOrderId?.trim() || null;
  if (purchaseOrderIdNorm) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderIdNorm, tenantId },
      select: { id: true },
    });
    if (!po) {
      return {
        ok: false,
        err: {
          error: "purchaseOrderId not found for tenant.",
          code: "NOT_FOUND",
          status: 404,
        },
      };
    }
  }

  const shipmentIdNorm = shipmentId?.trim() || null;
  if (shipmentIdNorm) {
    const sh = await prisma.shipment.findFirst({
      where: { id: shipmentIdNorm, order: { tenantId } },
      select: { id: true },
    });
    if (!sh) {
      return {
        ok: false,
        err: { error: "shipmentId not found for tenant.", code: "NOT_FOUND", status: 404 },
      };
    }
  }

  let asnPartnerPatch: string | null | undefined = undefined;
  if (params.asnPartnerId !== undefined) {
    const p = params.asnPartnerId?.trim() || null;
    if (p && p.length > 128) {
      return {
        ok: false,
        err: {
          error: "asnPartnerId must be at most 128 characters.",
          code: "VALIDATION_ERROR",
          status: 400,
        },
      };
    }
    asnPartnerPatch = p;
  }

  const prior = await prisma.wmsInboundAsnAdvise.findUnique({
    where: { tenantId_externalAsnId: { tenantId, externalAsnId } },
    select: { id: true },
  });

  const row = await prisma.wmsInboundAsnAdvise.upsert({
    where: { tenantId_externalAsnId: { tenantId, externalAsnId } },
    create: {
      tenantId,
      externalAsnId,
      warehouseId: warehouseIdNorm,
      purchaseOrderId: purchaseOrderIdNorm,
      shipmentId: shipmentIdNorm,
      asnReference: asnReference ?? null,
      expectedReceiveAt: expectedReceiveAt ?? null,
      linesJson,
      createdById: actorId,
      ...(asnPartnerPatch !== undefined ? { asnPartnerId: asnPartnerPatch } : {}),
      ...(rawPayloadJson !== undefined ? { rawPayloadJson } : {}),
    },
    update: {
      warehouseId: warehouseIdNorm,
      purchaseOrderId: purchaseOrderIdNorm,
      shipmentId: shipmentIdNorm,
      asnReference: asnReference ?? null,
      expectedReceiveAt: expectedReceiveAt ?? null,
      linesJson,
      ...(asnPartnerPatch !== undefined ? { asnPartnerId: asnPartnerPatch } : {}),
      ...(rawPayloadJson !== undefined ? { rawPayloadJson } : {}),
    },
  });

  return { ok: true, row: { id: row.id, externalAsnId: row.externalAsnId }, updated: prior !== null };
}
