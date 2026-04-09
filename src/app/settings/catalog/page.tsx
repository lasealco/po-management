import { CatalogAdminClient } from "@/components/catalog-admin-client";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export default async function SettingsCatalogPage() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <div className="py-8">
        <p className="text-zinc-600">Demo tenant not found. Run db:seed.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-zinc-900">
        Categories &amp; divisions
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        Tenant: <span className="font-medium text-zinc-800">{tenant.name}</span>
        . Values available when editing products.
      </p>
      <div className="mt-8">
        <CatalogAdminClient />
      </div>
    </div>
  );
}
