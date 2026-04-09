import { CatalogAdminClient } from "@/components/catalog-admin-client";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <p className="text-zinc-600">Demo tenant not found. Run db:seed.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-semibold text-zinc-900">Catalog setup</h1>
        <p className="mt-2 text-zinc-600">
          Tenant: <span className="font-medium">{tenant.name}</span>. Manage
          categories and divisions used on products.
        </p>
        <div className="mt-10">
          <CatalogAdminClient />
        </div>
      </main>
    </div>
  );
}
