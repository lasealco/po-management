import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { TARIFF_CONTRACT_VERSION_SOURCE_TYPE_SET } from "@/lib/tariff/contract-version-source-types";
import { getTariffContractVersionForTenant, updateTariffContractVersion } from "@/lib/tariff/contract-versions";
import { getDemoTenant } from "@/lib/demo-tenant";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";
import {
  TARIFF_APPROVAL_STATUS_SET,
  TARIFF_CONTRACT_HEADER_STATUS_SET,
} from "@/lib/tariff/tariff-enum-sets";
import { prisma } from "@/lib/prisma";

import type { TariffApprovalStatus, TariffContractStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

function parseDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const { id: contractHeaderId, versionId } = await context.params;
  const version = await prisma.tariffContractVersion.findFirst({
    where: {
      id: versionId,
      contractHeaderId,
      contractHeader: { tenantId: tenant.id },
    },
    include: {
      contractHeader: {
        include: { provider: true, legalEntity: true },
      },
      rateLines: { orderBy: { id: "asc" } },
      chargeLines: { include: { normalizedChargeCode: true }, orderBy: { id: "asc" } },
      freeTimeRules: { orderBy: { id: "asc" } },
    },
  });
  if (!version) return NextResponse.json({ error: "Version not found." }, { status: 404 });

  return NextResponse.json({ version });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object body." }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const { versionId } = await context.params;

  const before = await getTariffContractVersionForTenant({ tenantId: tenant.id, versionId });
  if (!before) return NextResponse.json({ error: "Version not found." }, { status: 404 });

  if (typeof o.sourceType === "string") {
    const st = o.sourceType.trim();
    if (!TARIFF_CONTRACT_VERSION_SOURCE_TYPE_SET.has(st)) {
      return NextResponse.json({ error: "Invalid sourceType." }, { status: 400 });
    }
  }
  if (typeof o.approvalStatus === "string") {
    const a = o.approvalStatus.trim();
    if (!TARIFF_APPROVAL_STATUS_SET.has(a)) {
      return NextResponse.json({ error: "Invalid approvalStatus." }, { status: 400 });
    }
  }
  if (typeof o.status === "string") {
    const s = o.status.trim();
    if (!TARIFF_CONTRACT_HEADER_STATUS_SET.has(s)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
  }

  try {
    const updated = await updateTariffContractVersion(
      { tenantId: tenant.id, versionId },
      {
        ...(typeof o.sourceType === "string" ? { sourceType: o.sourceType.trim() as never } : {}),
        ...(typeof o.sourceReference === "string" || o.sourceReference === null
          ? { sourceReference: typeof o.sourceReference === "string" ? o.sourceReference.trim() || null : null }
          : {}),
        ...(typeof o.sourceFileUrl === "string" || o.sourceFileUrl === null
          ? { sourceFileUrl: typeof o.sourceFileUrl === "string" ? o.sourceFileUrl.trim() || null : null }
          : {}),
        ...(typeof o.approvalStatus === "string"
          ? { approvalStatus: o.approvalStatus.trim() as TariffApprovalStatus }
          : {}),
        ...(typeof o.status === "string" ? { status: o.status.trim() as TariffContractStatus } : {}),
        ...(o.validFrom !== undefined ? { validFrom: parseDate(o.validFrom) } : {}),
        ...(o.validTo !== undefined ? { validTo: parseDate(o.validTo) } : {}),
        ...(o.bookingDateValidFrom !== undefined ? { bookingDateValidFrom: parseDate(o.bookingDateValidFrom) } : {}),
        ...(o.bookingDateValidTo !== undefined ? { bookingDateValidTo: parseDate(o.bookingDateValidTo) } : {}),
        ...(o.sailingDateValidFrom !== undefined ? { sailingDateValidFrom: parseDate(o.sailingDateValidFrom) } : {}),
        ...(o.sailingDateValidTo !== undefined ? { sailingDateValidTo: parseDate(o.sailingDateValidTo) } : {}),
        ...(typeof o.comments === "string" || o.comments === null
          ? { comments: typeof o.comments === "string" ? o.comments.trim() || null : null }
          : {}),
      },
    );
    await recordTariffAuditLog({
      objectType: "contract_version",
      objectId: versionId,
      action: "update",
      userId: actorId,
      oldValue: before,
      newValue: {
        approvalStatus: updated.approvalStatus,
        status: updated.status,
        validFrom: updated.validFrom,
        validTo: updated.validTo,
        sourceType: updated.sourceType,
        sourceReference: updated.sourceReference,
        sourceFileUrl: updated.sourceFileUrl,
      },
    });
    return NextResponse.json({ version: updated });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
