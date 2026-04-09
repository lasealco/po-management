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

  const [products, categories, divisions, supplierOffices, suppliers] =
    await Promise.all([
      prisma.product.findMany({
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
      }),
      prisma.productCategory.findMany({
        where: { tenantId: tenant.id },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      }),
      prisma.productDivision.findMany({
        where: { tenantId: tenant.id },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      }),
      prisma.supplierOffice.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: { name: "asc" },
        include: { supplier: { select: { name: true } } },
      }),
      prisma.supplier.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  const officeOptions = supplierOffices.map((o) => ({
    id: o.id,
    label: `${o.supplier.name} — ${o.name}`,
  }));

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
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-zinc-900">Products</h1>
          <p className="mt-2 text-zinc-600">
            Tenant: <span className="font-medium">{tenant.name}</span> (
            {products.length} {products.length === 1 ? "product" : "products"})
          </p>
        </header>

        <section className="mb-10">
          <h2 className="mb-3 text-lg font-medium text-zinc-900">Catalog</h2>
          <ProductList products={productRows} />
        </section>

        <section className="border-t border-zinc-200 pt-10">
          <ProductCreatePanel
            categories={categories}
            divisions={divisions}
            supplierOffices={officeOptions}
            suppliers={suppliers}
          />
        </section>
      </main>
    </div>
  );
}
