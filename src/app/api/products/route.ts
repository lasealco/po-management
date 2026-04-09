import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseProductCreateBody } from "@/lib/parse-product-create";

const DEFAULT_TENANT_SLUG = "demo-company";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseProductCreateBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const d = parsed.data;
  const supplierIds = [...new Set(d.supplierIds)];

  let flashPoint: Prisma.Decimal | null = null;
  if (d.flashPoint) {
    const n = Number(d.flashPoint);
    if (!Number.isFinite(n)) {
      return NextResponse.json(
        { error: "flashPoint must be a number." },
        { status: 400 },
      );
    }
    flashPoint = new Prisma.Decimal(n);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEFAULT_TENANT_SLUG },
    select: { id: true },
  });

  if (!tenant) {
    return NextResponse.json(
      {
        error:
          "Demo tenant not found. Run `npm run db:seed` to create starter data.",
      },
      { status: 404 },
    );
  }

  if (d.categoryId) {
    const found = await prisma.productCategory.findFirst({
      where: { id: d.categoryId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!found) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
  }

  if (d.divisionId) {
    const found = await prisma.productDivision.findFirst({
      where: { id: d.divisionId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!found) {
      return NextResponse.json({ error: "Invalid division." }, { status: 400 });
    }
  }

  if (d.supplierOfficeId) {
    const found = await prisma.supplierOffice.findFirst({
      where: { id: d.supplierOfficeId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!found) {
      return NextResponse.json(
        { error: "Invalid supplier office." },
        { status: 400 },
      );
    }
  }

  if (supplierIds.length) {
    const count = await prisma.supplier.count({
      where: { tenantId: tenant.id, id: { in: supplierIds } },
    });
    if (count !== supplierIds.length) {
      return NextResponse.json(
        { error: "One or more suppliers are invalid." },
        { status: 400 },
      );
    }
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
      return NextResponse.json(
        {
          error:
            "A product with this code or SKU already exists for this tenant.",
        },
        { status: 409 },
      );
    }
    throw e;
  }
}
