import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { getActorUserId, requireApiGrant, userHasRoleNamed } from "@/lib/authz";
import { writeCtAudit } from "@/lib/control-tower/audit";
import { prisma } from "@/lib/prisma";
import { getDemoTenant } from "@/lib/demo-tenant";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.controltower", "edit");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId || (await userHasRoleNamed(actorId, "Supplier portal"))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const shipmentId = String(form.get("shipmentId") ?? "").trim();
  const docType = String(form.get("docType") ?? "OTHER").trim() || "OTHER";
  const visibilityRaw = String(form.get("visibility") ?? "INTERNAL").trim();
  const visibility =
    visibilityRaw === "CUSTOMER_SHAREABLE" ? "CUSTOMER_SHAREABLE" : "INTERNAL";

  if (!shipmentId) {
    return NextResponse.json({ error: "shipmentId is required." }, { status: 400 });
  }

  const shipment = await prisma.shipment.findFirst({
    where: { id: shipmentId, order: { tenantId: tenant.id } },
    select: { id: true },
  });
  if (!shipment) {
    return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Use PDF, JPEG, PNG, or WebP." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be at most 15 MB." }, { status: 400 });
  }

  const ext = MIME_EXT[file.type] ?? "bin";
  const basename = `ct-${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  let url: string;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(basename, bytes, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type,
    });
    url = blob.url;
  } else if (process.env.NODE_ENV === "development") {
    const dir = join(process.cwd(), "public", "uploads", "control-tower");
    await mkdir(dir, { recursive: true });
    const path = join(dir, basename);
    await writeFile(path, bytes);
    url = `/uploads/control-tower/${basename}`;
  } else {
    return NextResponse.json(
      {
        error:
          "Upload is not configured. Add BLOB_READ_WRITE_TOKEN for production, or run locally.",
      },
      { status: 503 },
    );
  }

  const row = await prisma.ctShipmentDocument.create({
    data: {
      tenantId: tenant.id,
      shipmentId,
      docType,
      fileName: file.name || basename,
      blobUrl: url,
      visibility,
      uploadedById: actorId,
    },
  });

  await writeCtAudit({
    tenantId: tenant.id,
    shipmentId,
    entityType: "CtShipmentDocument",
    entityId: row.id,
    action: "upload",
    actorUserId: actorId,
    payload: { docType, fileName: file.name || basename, visibility },
  });

  return NextResponse.json({ ok: true, id: row.id, url });
}
