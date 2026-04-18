import type { TariffSourceType } from "@prisma/client";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant } from "@/lib/authz";
import { recordTariffAuditLog } from "@/lib/tariff/audit-log";
import { createTariffImportBatch, listTariffImportBatchesForTenant } from "@/lib/tariff/import-batches";
import { assertTariffImportMime, storeTariffImportFile } from "@/lib/tariff/store-tariff-import-file";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";
import { jsonFromTariffError } from "@/app/api/tariffs/_lib/tariff-api-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sourceTypeFromMime(mime: string): TariffSourceType {
  if (mime === "application/pdf") return "PDF";
  return "EXCEL";
}

export async function GET() {
  const gate = await requireApiGrant("org.tariffs", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const batches = await listTariffImportBatchesForTenant({ tenantId: tenant.id, take: 200 });
  return NextResponse.json({ batches });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.tariffs", "edit");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field." }, { status: 400 });
  }

  const legalEntityId: string | null =
    typeof form.get("legalEntityId") === "string" ? String(form.get("legalEntityId")).trim() || null : null;

  if (legalEntityId) {
    const le = await prisma.tariffLegalEntity.findFirst({
      where: { id: legalEntityId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!le) {
      return NextResponse.json({ error: "Legal entity not found for this tenant." }, { status: 400 });
    }
  }

  try {
    assertTariffImportMime(file.type);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid file type.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let stored: { url: string; byteSize: number };
  try {
    stored = await storeTariffImportFile({
      bytes,
      mimeType: file.type,
      originalFileName: file.name || "upload",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Storage failed.";
    const status = msg.includes("not configured") ? 503 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  const uploadedFilename = file.name?.trim() || null;
  const sourceType = sourceTypeFromMime(file.type);
  const sourceMetadata = {
    clientFileName: uploadedFilename,
    uploadedAt: new Date().toISOString(),
    uploadedByUserId: actorId,
    contentType: file.type,
  };

  try {
    const created = await createTariffImportBatch({
      tenantId: tenant.id,
      legalEntityId,
      sourceType,
      uploadedFilename,
      sourceReference: null,
      sourceFileUrl: stored.url,
      sourceMimeType: file.type,
      sourceByteSize: stored.byteSize,
      sourceMetadata,
      parseStatus: "UPLOADED",
      reviewStatus: "PENDING",
    });

    await recordTariffAuditLog({
      objectType: "import_batch",
      objectId: created.id,
      action: "upload",
      userId: actorId,
      newValue: {
        sourceType,
        parseStatus: created.parseStatus,
        reviewStatus: created.reviewStatus,
        uploadedFilename,
        sourceByteSize: stored.byteSize,
      },
    });

    return NextResponse.json({ batch: created });
  } catch (e) {
    const j = jsonFromTariffError(e);
    if (j) return j;
    throw e;
  }
}
