import type { SrmSupplierDocumentStatus, SrmSupplierDocumentType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { appendSrmSupplierDocumentAudit } from "@/lib/srm/srm-supplier-document-audit";
import { parseSrmSupplierDocumentType, toSrmSupplierDocumentJson } from "@/lib/srm/srm-supplier-document-helpers";
import { prisma } from "@/lib/prisma";

const listInclude = {
  uploadedBy: { select: { id: true, name: true, email: true } },
  lastModifiedBy: { select: { id: true, name: true, email: true } },
} as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id: supplierId, docId } = await context.params;
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

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const existing = await prisma.srmSupplierDocument.findFirst({
    where: { id: docId, tenantId: tenant.id, supplierId },
    include: listInclude,
  });
  if (!existing) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }

  const data: {
    title?: string | null;
    documentType?: SrmSupplierDocumentType;
    status?: SrmSupplierDocumentStatus;
    expiresAt?: Date | null;
    lastModifiedById: string;
  } = { lastModifiedById: actorId };

  if (o.title !== undefined) {
    if (o.title === null) data.title = null;
    else if (typeof o.title === "string") data.title = o.title.trim() ? o.title.trim().slice(0, 256) : null;
    else
      return toApiErrorResponse({ error: "Invalid title.", code: "BAD_INPUT", status: 400 });
  }
  if (o.documentType !== undefined) {
    if (typeof o.documentType !== "string") {
      return toApiErrorResponse({ error: "Invalid documentType.", code: "BAD_INPUT", status: 400 });
    }
    const dt = parseSrmSupplierDocumentType(o.documentType);
    if (!dt) {
      return toApiErrorResponse({ error: "Invalid documentType.", code: "BAD_INPUT", status: 400 });
    }
    data.documentType = dt;
  }
  if (o.status !== undefined) {
    if (o.status === "active" || o.status === "archived" || o.status === "superseded") {
      data.status = o.status;
    } else {
      return toApiErrorResponse({ error: "Invalid status.", code: "BAD_INPUT", status: 400 });
    }
  }
  if (o.expiresAt !== undefined) {
    if (o.expiresAt === null) data.expiresAt = null;
    else if (typeof o.expiresAt === "string") {
      const d = new Date(o.expiresAt);
      if (Number.isNaN(d.getTime())) {
        return toApiErrorResponse({ error: "Invalid expiresAt.", code: "BAD_INPUT", status: 400 });
      }
      data.expiresAt = d;
    } else {
      return toApiErrorResponse({ error: "Invalid expiresAt.", code: "BAD_INPUT", status: 400 });
    }
  }

  if (
    data.title === undefined &&
    data.documentType === undefined &&
    data.status === undefined &&
    data.expiresAt === undefined
  ) {
    return toApiErrorResponse({ error: "No changes.", code: "BAD_INPUT", status: 400 });
  }

  const updated = await prisma.srmSupplierDocument.update({
    where: { id: existing.id },
    data,
    include: listInclude,
  });

  const patchKeys = ["title", "documentType", "status", "expiresAt"] as const;
  const details: Record<string, unknown> = {};
  for (const k of patchKeys) {
    if (o[k] !== undefined) details[k] = o[k];
  }

  await appendSrmSupplierDocumentAudit(prisma, {
    tenantId: tenant.id,
    documentId: updated.id,
    actorUserId: actorId,
    action: "update",
    details: JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue,
  });

  return NextResponse.json({ document: toSrmSupplierDocumentJson(updated) });
}

/** Archives the document (soft delete). View-only users may not call this. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; docId: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

  const { id: supplierId, docId } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const existing = await prisma.srmSupplierDocument.findFirst({
    where: { id: docId, tenantId: tenant.id, supplierId },
  });
  if (!existing) {
    return toApiErrorResponse({ error: "Not found.", code: "NOT_FOUND", status: 404 });
  }

  const updated = await prisma.srmSupplierDocument.update({
    where: { id: existing.id },
    data: { status: "archived", lastModifiedById: actorId },
    include: listInclude,
  });

  await appendSrmSupplierDocumentAudit(prisma, {
    tenantId: tenant.id,
    documentId: updated.id,
    actorUserId: actorId,
    action: "archived",
  });

  return NextResponse.json({ document: toSrmSupplierDocumentJson(updated) });
}
