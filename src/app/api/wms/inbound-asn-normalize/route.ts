import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { inboundAsnAdviseLinesToPrismaJson } from "@/lib/wms/inbound-asn-advise";
import { upsertInboundAsnAdviseRow } from "@/lib/wms/inbound-asn-advise-upsert";
import type { Bf75EnvelopeHint } from "@/lib/wms/inbound-asn-normalize-bf75";
import { normalizeInboundAsnEnvelopeBf75 } from "@/lib/wms/inbound-asn-normalize-bf75";
import { gateWmsTierMutation } from "@/lib/wms/wms-mutation-grants";

export const dynamic = "force-dynamic";

type PostBody = {
  partnerId?: string;
  rawEnvelope?: unknown;
  envelopeHint?: Bf75EnvelopeHint;
  persist?: boolean;
  warehouseId?: string | null;
  purchaseOrderId?: string | null;
  shipmentId?: string | null;
};

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

  const partnerId = body.partnerId ?? "";
  const normalized = normalizeInboundAsnEnvelopeBf75({
    partnerId,
    rawEnvelope: body.rawEnvelope,
    envelopeHint: body.envelopeHint,
  });
  if (!normalized.ok) {
    return toApiErrorResponse({ error: normalized.error, code: "VALIDATION_ERROR", status: 400 });
  }

  const doc = normalized.doc;
  const persist = body.persist !== false;

  if (!persist) {
    return NextResponse.json({ ok: true, normalized: doc });
  }

  const expectedAt = doc.expectedReceiveAt ? new Date(doc.expectedReceiveAt) : null;

  const rawPayloadJson: Prisma.InputJsonValue = {
    bf75: {
      schemaVersion: doc.schemaVersion,
      partnerId: doc.partnerId,
      envelopeHint: body.envelopeHint ?? null,
    },
    envelope: body.rawEnvelope === undefined ? null : body.rawEnvelope,
  };

  const up = await upsertInboundAsnAdviseRow(prisma, {
    tenantId: tenant.id,
    actorId,
    externalAsnId: doc.externalAsnId,
    linesJson: inboundAsnAdviseLinesToPrismaJson(doc.lines),
    asnPartnerId: doc.partnerId,
    asnReference: doc.asnReference,
    expectedReceiveAt: expectedAt && Number.isFinite(expectedAt.getTime()) ? expectedAt : null,
    warehouseId: body.warehouseId?.trim() || null,
    purchaseOrderId: body.purchaseOrderId?.trim() || null,
    shipmentId: body.shipmentId?.trim() || null,
    rawPayloadJson,
  });

  if (!up.ok) {
    return toApiErrorResponse(up.err);
  }

  return NextResponse.json({
    ok: true,
    normalized: doc,
    adviseId: up.row.id,
    externalAsnId: up.row.externalAsnId,
    updated: up.updated,
  });
}
