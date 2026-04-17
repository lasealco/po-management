import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { ProductEditClient } from "@/components/product-edit-client";
import type { ProductFormInitial } from "@/components/product-catalog-form";
import { ProductReadOnly } from "@/components/product-read-only";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getProductFormOptions } from "@/lib/product-form-options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getViewerGrantSet();
  if (!access) notFound();

  if (!access.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Product"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }

  const canView = viewerHas(access.grantSet, "org.products", "view");
  const canEdit = viewerHas(access.grantSet, "org.products", "edit");

  if (!canView) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Product"
          message="You do not have permission to view products (org.products → view)."
        />
      </div>
    );
  }

  const { tenant } = access;

  const product = await prisma.product.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      category: { select: { id: true, name: true } },
      division: { select: { id: true, name: true } },
      supplierOffice: {
        select: {
          id: true,
          name: true,
          supplier: { select: { name: true } },
        },
      },
      productSuppliers: {
        include: { supplier: { select: { name: true } } },
      },
    },
  });
  if (!product) notFound();

  if (!canEdit) {
    const readProduct = {
      productCode: product.productCode,
      sku: product.sku,
      name: product.name,
      description: product.description,
      unit: product.unit,
      isActive: product.isActive,
      category: product.category,
      division: product.division,
      ean: product.ean,
      customerName: product.customerName,
      primaryImageUrl: product.primaryImageUrl,
      hsCode: product.hsCode,
      isDangerousGoods: product.isDangerousGoods,
      dangerousGoodsClass: product.dangerousGoodsClass,
      unNumber: product.unNumber,
      properShippingName: product.properShippingName,
      packingGroup: product.packingGroup,
      flashPoint: product.flashPoint?.toString() ?? null,
      flashPointUnit: product.flashPointUnit,
      msdsUrl: product.msdsUrl,
      isTemperatureControlled: product.isTemperatureControlled,
      temperatureRangeText: product.temperatureRangeText,
      temperatureUnit: product.temperatureUnit,
      coolingType: product.coolingType,
      packagingNotes: product.packagingNotes,
      humidityRequirements: product.humidityRequirements,
      storageDescription: product.storageDescription,
      isForReexport: product.isForReexport,
      supplierOffice: product.supplierOffice,
      linkedSuppliers: product.productSuppliers.map((ps) => ({
        name: ps.supplier.name,
      })),
    };

    return (
      <div className="min-h-screen bg-zinc-50">
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
          <Link
            href="/products"
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            ← Product catalog
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
            {product.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">View only</p>
          <ProductReadOnly product={readProduct} />
        </main>
      </div>
    );
  }

  const opts = await getProductFormOptions(tenant.id);

  const initial: ProductFormInitial = {
    productCode: product.productCode ?? "",
    name: product.name,
    description: product.description ?? "",
    sku: product.sku ?? "",
    unit: product.unit ?? "",
    categoryId: product.categoryId ?? "",
    divisionId: product.divisionId ?? "",
    ean: product.ean ?? "",
    customerName: product.customerName ?? "",
    primaryImageUrl: product.primaryImageUrl ?? "",
    hsCode: product.hsCode ?? "",
    isDangerousGoods: product.isDangerousGoods,
    dangerousGoodsClass: product.dangerousGoodsClass ?? "",
    unNumber: product.unNumber ?? "",
    properShippingName: product.properShippingName ?? "",
    packingGroup: product.packingGroup ?? "",
    flashPoint: product.flashPoint?.toString() ?? "",
    flashPointUnit: product.flashPointUnit ?? "",
    msdsUrl: product.msdsUrl ?? "",
    isTemperatureControlled: product.isTemperatureControlled,
    temperatureRangeText: product.temperatureRangeText ?? "",
    temperatureUnit: product.temperatureUnit ?? "",
    coolingType: product.coolingType ?? "",
    packagingNotes: product.packagingNotes ?? "",
    humidityRequirements: product.humidityRequirements ?? "",
    storageDescription: product.storageDescription ?? "",
    isForReexport: product.isForReexport,
    supplierOfficeId: product.supplierOfficeId ?? "",
    linkedSupplierIds: product.productSuppliers.map((x) => x.supplierId),
    isActive: product.isActive,
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        <Link
          href="/products"
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← Product catalog
        </Link>
        <div className="mt-2">
          <ProductEditClient
            productId={product.id}
            initial={initial}
            categories={opts.categories}
            divisions={opts.divisions}
            supplierOffices={opts.supplierOffices}
            suppliers={opts.suppliers}
          />
        </div>
      </main>
    </div>
  );
}
