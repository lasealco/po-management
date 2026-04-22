import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { assertProductRelationsValid } from "@/lib/product-mutation";
import { parseProductCreateBody } from "@/lib/parse-product-create";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.products", "edit");
  if (gate) return gate;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  const parsed = parseProductCreateBody(body);
  if (!parsed.ok) {
    return toApiErrorResponse({ error: parsed.error, code: "BAD_INPUT", status: 400 });
  }

  const d = parsed.data;
  const supplierIds = [...new Set(d.supplierIds)];

  let flashPoint: Prisma.Decimal | null = null;
  if (d.flashPoint) {
    const n = Number(d.flashPoint);
    if (!Number.isFinite(n)) {
      return toApiErrorResponse({ error: "flashPoint must be a number.", code: "BAD_INPUT", status: 400 });
    }
    flashPoint = new Prisma.Decimal(n);
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found. Run `npm run db:seed` to create starter data.", code: "NOT_FOUND", status: 404 });
  }

  const existing = await prisma.product.findFirst({
    where: { id, tenantId: tenant.id },
    select: { id: true },
  });
  if (!existing) {
    return toApiErrorResponse({ error: "Product not found.", code: "NOT_FOUND", status: 404 });
  }

  try {
    await assertProductRelationsValid(prisma, tenant.id, d, supplierIds);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "INVALID_CATEGORY") {
      return toApiErrorResponse({ error: "Invalid category.", code: "BAD_INPUT", status: 400 });
    }
    if (msg === "INVALID_DIVISION") {
      return toApiErrorResponse({ error: "Invalid division.", code: "BAD_INPUT", status: 400 });
    }
    if (msg === "INVALID_OFFICE") {
      return toApiErrorResponse({ error: "Invalid supplier office.", code: "BAD_INPUT", status: 400 });
    }
    if (msg === "INVALID_SUPPLIERS") {
      return toApiErrorResponse({ error: "One or more suppliers are invalid.", code: "BAD_INPUT", status: 400 });
    }
    throw e;
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id },
        data: {
          productCode: d.productCode,
          sku: d.sku,
          name: d.name,
          description: d.description,
          unit: d.unit,
          categoryId: d.categoryId,
          divisionId: d.divisionId,
          ean: d.ean,
          customerName: d.customerName,
          primaryImageUrl: d.primaryImageUrl,
          hsCode: d.hsCode,
          isDangerousGoods: d.isDangerousGoods,
          dangerousGoodsClass: d.dangerousGoodsClass,
          unNumber: d.unNumber,
          properShippingName: d.properShippingName,
          packingGroup: d.packingGroup,
          flashPoint,
          flashPointUnit: d.flashPointUnit,
          msdsUrl: d.msdsUrl,
          isTemperatureControlled: d.isTemperatureControlled,
          temperatureRangeText: d.temperatureRangeText,
          temperatureUnit: d.temperatureUnit,
          coolingType: d.coolingType,
          packagingNotes: d.packagingNotes,
          humidityRequirements: d.humidityRequirements,
          storageDescription: d.storageDescription,
          isForReexport: d.isForReexport,
          supplierOfficeId: d.supplierOfficeId,
          isActive: d.isActive,
        },
        select: { id: true, name: true, productCode: true },
      });

      await tx.productSupplier.deleteMany({ where: { productId: id } });
      if (supplierIds.length) {
        await tx.productSupplier.createMany({
          data: supplierIds.map((supplierId) => ({
            productId: id,
            supplierId,
          })),
        });
      }

      await tx.productDocument.deleteMany({ where: { productId: id } });
      if (d.documents.length) {
        await tx.productDocument.createMany({
          data: d.documents.map((doc) => ({
            productId: id,
            kind: doc.kind,
            fileName: doc.fileName,
            url: doc.url,
            mimeType: doc.mimeType ?? null,
            sizeBytes: doc.sizeBytes ?? null,
          })),
        });
      }

      return p;
    });

    return NextResponse.json({ product });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? (e as { code: string }).code
        : null;
    if (code === "P2002") {
      return toApiErrorResponse({ error: "A product with this code or SKU already exists for this tenant.", code: "CONFLICT", status: 409 });
    }
    throw e;
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiGrant("org.products", "edit");
  if (gate) return gate;

  const { id } = await context.params;
  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });
  }

  const product = await prisma.product.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      _count: { select: { orderItems: true } },
    },
  });

  if (!product) {
    return toApiErrorResponse({ error: "Product not found.", code: "NOT_FOUND", status: 404 });
  }

  if (product._count.orderItems > 0) {
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true, deactivated: true });
  }

  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: true });
}
