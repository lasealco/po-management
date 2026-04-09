import Link from "next/link";
import { ProductList } from "@/components/product-list";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProductCatalogPage() {
  const tenant = await getDemoTenant();

  if (!tenant) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <main className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-3xl font-semibold text-zinc-900">Product catalog</h1>
          <p className="mt-4 text-zinc-600">
            Demo tenant not found. Run <code>npm run db:seed</code> locally,
            then deploy.
          </p>
        </main>
      </div>
    );
  }

  const products = await prisma.product.findMany({
    where: { tenantId: tenant.id },
    orderBy: { productCode: "asc" },
    select: {
      id: true,
      productCode: true,
      sku: true,
      name: true,
      description: true,
      unit: true,
      isActive: true,
      updatedAt: true,
      category: { select: { name: true } },
      division: { select: { name: true } },
      _count: { select: { productSuppliers: true } },
    },
  });

  const productRows = products.map((p) => ({
    id: p.id,
    productCode: p.productCode,
    sku: p.sku,
    name: p.name,
    description: p.description,
    unit: p.unit,
    isActive: p.isActive,
    updatedAt: p.updatedAt,
    category: p.category,
    division: p.division,
    supplierCount: p._count.productSuppliers,
  }));

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900">
              Product catalog
            </h1>
            <p className="mt-2 text-zinc-600">
              Tenant: <span className="font-medium">{tenant.name}</span> (
              {products.length}{" "}
              {products.length === 1 ? "product" : "products"})
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Categories and divisions:{" "}
              <Link href="/catalog" className="text-amber-900 underline-offset-2 hover:underline">
                Catalog setup
              </Link>
              .
            </p>
          </div>
          <Link
            href="/products/new"
            className="inline-flex w-fit items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Add product
          </Link>
        </header>

        <ProductList products={productRows} />
      </main>
    </div>
  );
}
