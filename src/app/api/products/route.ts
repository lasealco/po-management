import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { assertProductRelationsValid } from "@/lib/product-mutation";
import { parseProductCreateBody } from "@/lib/parse-product-create";
import { prisma } from "@/lib/prisma";
import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";


export async function POST(request: Request) {
  const gate = await requireApiGrant("org.products", "edit");
  if (gate) return gate;

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
      const p = await tx.product.create({
        data: {
          tenantId: tenant.id,
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

      if (supplierIds.length) {
        await tx.productSupplier.createMany({
          data: supplierIds.map((supplierId) => ({
            productId: p.id,
            supplierId,
          })),
          skipDuplicates: true,
        });
      }

      if (d.documents.length) {
        await tx.productDocument.createMany({
          data: d.documents.map((doc) => ({
            productId: p.id,
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
