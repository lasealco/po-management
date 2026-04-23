import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { put } from "@vercel/blob";
import { Prisma } from "@prisma/client";
import type { SrmSupplierDocumentStatus, SrmSupplierDocumentType } from "@prisma/client";
import { NextResponse } from "next/server";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { appendSrmSupplierDocumentAudit } from "@/lib/srm/srm-supplier-document-audit";
import { parseSrmSupplierDocumentType, toSrmSupplierDocumentJson } from "@/lib/srm/srm-supplier-document-helpers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

class SrmDocumentUploadError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SrmDocumentUploadError";
  }
}

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
};

const listInclude = {
  uploadedBy: { select: { id: true, name: true, email: true } },
  lastModifiedBy: { select: { id: true, name: true, email: true } },
} as const;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "view");
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

  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const where: {
    tenantId: string;
    supplierId: string;
    status?: { in: SrmSupplierDocumentStatus[] } | SrmSupplierDocumentStatus;
  } = {
    tenantId: tenant.id,
    supplierId,
  };
  if (!includeArchived) {
    where.status = { in: ["active", "superseded"] };
  }

  const rows = await prisma.srmSupplierDocument.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    include: listInclude,
  });

  return NextResponse.json({ documents: rows.map(toSrmSupplierDocumentJson) });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });
  }

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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return toApiErrorResponse({ error: "Expected multipart form data.", code: "BAD_INPUT", status: 400 });
  }

  const supersedesRaw = String(form.get("supersedesDocumentId") ?? "").trim();
  const supersedesDocumentId = supersedesRaw || null;

  const documentType = parseSrmSupplierDocumentType(String(form.get("documentType") ?? ""));
  if (!documentType) {
    return toApiErrorResponse({ error: "Invalid documentType.", code: "BAD_INPUT", status: 400 });
  }
  const titleRaw = String(form.get("title") ?? "").trim();
  const title = titleRaw ? titleRaw.slice(0, 256) : null;
  const expiresRaw = String(form.get("expiresAt") ?? "").trim();
  let expiresAt: Date | null = null;
  if (expiresRaw) {
    const d = new Date(expiresRaw);
    if (Number.isNaN(d.getTime())) {
      return toApiErrorResponse({ error: "Invalid expiresAt.", code: "BAD_INPUT", status: 400 });
    }
    expiresAt = d;
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return toApiErrorResponse({ error: "Missing file field.", code: "BAD_INPUT", status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return toApiErrorResponse({
      error: "Unsupported file type. Use PDF, Word, JPEG, PNG, or WebP.",
      code: "BAD_INPUT",
      status: 400,
    });
  }
  if (file.size > MAX_BYTES) {
    return toApiErrorResponse({ error: "File must be at most 15 MB.", code: "BAD_INPUT", status: 400 });
  }

  const ext = MIME_EXT[file.type] ?? "bin";
  const basename = `srm-doc-${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  let fileUrl: string;
  const storageKey: string | null = basename;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(basename, bytes, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type,
    });
    fileUrl = blob.url;
  } else if (process.env.NODE_ENV === "development") {
    const dir = join(process.cwd(), "public", "uploads", "srm-documents");
    await mkdir(dir, { recursive: true });
    const path = join(dir, basename);
    await writeFile(path, bytes);
    fileUrl = `/uploads/srm-documents/${basename}`;
  } else {
    return toApiErrorResponse({
      error: "Upload is not configured. Add BLOB_READ_WRITE_TOKEN for production, or run locally.",
      code: "UNAVAILABLE",
      status: 503,
    });
  }

  if (!supersedesDocumentId) {
    const revisionGroupId = randomUUID();
    const row = await prisma.srmSupplierDocument.create({
      data: {
        tenantId: tenant.id,
        supplierId,
        documentType: documentType as SrmSupplierDocumentType,
        status: "active",
        title,
        fileName: file.name || basename,
        mimeType: file.type,
        fileSize: file.size,
        storageKey,
        fileUrl,
        expiresAt,
        uploadedById: actorId,
        lastModifiedById: actorId,
        revisionGroupId,
        revisionNumber: 1,
        supersedesDocumentId: null,
      },
      include: listInclude,
    });

    await appendSrmSupplierDocumentAudit(prisma, {
      tenantId: tenant.id,
      documentId: row.id,
      actorUserId: actorId,
      action: "upload",
      details: {
        fileName: row.fileName,
        documentType,
        title,
        expiresAt: expiresAt?.toISOString() ?? null,
        revisionGroupId,
        revisionNumber: 1,
      },
    });

    return NextResponse.json({ document: toSrmSupplierDocumentJson(row) });
  }

  // New revision: replace an active document; prior row → superseded in one transaction.
  try {
    const row = await prisma.$transaction(async (tx) => {
      const previous = await tx.srmSupplierDocument.findFirst({
        where: {
          id: supersedesDocumentId,
          tenantId: tenant.id,
          supplierId,
        },
        select: {
          id: true,
          status: true,
          documentType: true,
          revisionGroupId: true,
        },
      });
      if (!previous) {
        throw new SrmDocumentUploadError(404, "not_found", "The document to replace was not found.");
      }
      if (previous.status !== "active") {
        throw new SrmDocumentUploadError(
          400,
          "not_active",
          "Only the active file in a chain can be replaced. Un-archive or add a new document type instead.",
        );
      }
      if (previous.documentType !== (documentType as SrmSupplierDocumentType)) {
        throw new SrmDocumentUploadError(
          400,
          "type_mismatch",
          "Document type must match the file you are replacing (use the same type as the current revision).",
        );
      }
      const agg = await tx.srmSupplierDocument.aggregate({
        where: { tenantId: tenant.id, revisionGroupId: previous.revisionGroupId },
        _max: { revisionNumber: true },
      });
      const nextRev = (agg._max.revisionNumber ?? 0) + 1;
      if (nextRev < 2) {
        throw new SrmDocumentUploadError(500, "revision", "Invalid revision state.");
      }

      const created = await tx.srmSupplierDocument.create({
        data: {
          tenantId: tenant.id,
          supplierId,
          documentType: documentType as SrmSupplierDocumentType,
          status: "active",
          title,
          fileName: file.name || basename,
          mimeType: file.type,
          fileSize: file.size,
          storageKey,
          fileUrl,
          expiresAt,
          uploadedById: actorId,
          lastModifiedById: actorId,
          revisionGroupId: previous.revisionGroupId,
          revisionNumber: nextRev,
          supersedesDocumentId: previous.id,
        },
        include: listInclude,
      });

      await tx.srmSupplierDocument.update({
        where: { id: previous.id },
        data: { status: "superseded", lastModifiedById: actorId },
      });

      await appendSrmSupplierDocumentAudit(tx, {
        tenantId: tenant.id,
        documentId: previous.id,
        actorUserId: actorId,
        action: "superseded",
        details: { replacedByDocumentId: created.id, revisionNumber: nextRev },
      });

      await appendSrmSupplierDocumentAudit(tx, {
        tenantId: tenant.id,
        documentId: created.id,
        actorUserId: actorId,
        action: "upload",
        details: {
          fileName: created.fileName,
          documentType,
          title,
          expiresAt: expiresAt?.toISOString() ?? null,
          supersedesDocumentId: previous.id,
          revisionGroupId: previous.revisionGroupId,
          revisionNumber: nextRev,
        },
      });

      return created;
    });
    return NextResponse.json({ document: toSrmSupplierDocumentJson(row) });
  } catch (e) {
    if (e instanceof SrmDocumentUploadError) {
      return toApiErrorResponse({ error: e.message, code: e.code, status: e.status });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return toApiErrorResponse({
        error: "A revision with this number already exists. Try again.",
        code: "CONFLICT",
        status: 409,
      });
    }
    throw e;
  }
}
