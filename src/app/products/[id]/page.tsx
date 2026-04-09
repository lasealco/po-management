import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductEditClient } from "@/components/product-edit-client";
import type { ProductFormInitial } from "@/components/product-catalog-form";
import { getDemoTenant } from "@/lib/demo-tenant";
import { getProductFormOptions } from "@/lib/product-form-options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getDemoTenant();
  if (!tenant) notFound();

  const product = await prisma.product.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      productSuppliers: { select: { supplierId: true } },
    },
  });
  if (!product) notFound();

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
