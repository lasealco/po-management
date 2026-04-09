import { ProductCreatePanel } from "@/components/product-create-panel";
import { ProductList } from "@/components/product-list";
import { prisma } from "@/lib/prisma";

const DEFAULT_TENANT_SLUG = "demo-company";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEFAULT_TENANT_SLUG },
    select: { id: true, name: true },
  });

  if (!tenant) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <main className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-3xl font-semibold text-zinc-900">Products</h1>
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
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      sku: true,
      name: true,
      description: true,
      unit: true,
      isActive: true,
      updatedAt: true,
    },
  });

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-zinc-900">Products</h1>
          <p className="mt-2 text-zinc-600">
            Tenant: <span className="font-medium">{tenant.name}</span> (
            {products.length} {products.length === 1 ? "product" : "products"})
          </p>
        </header>

        <section className="mb-10">
          <h2 className="mb-3 text-lg font-medium text-zinc-900">Catalog</h2>
          <ProductList products={products} />
        </section>

        <section className="border-t border-zinc-200 pt-10">
          <ProductCreatePanel />
        </section>
      </main>
    </div>
  );
}
