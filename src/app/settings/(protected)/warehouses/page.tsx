import { SettingsWarehousesClient } from "@/components/settings-warehouses-client";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsWarehousesPage() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <div className="py-8">
        <p className="text-zinc-600">Demo tenant not found. Run db:seed.</p>
      </div>
    );
  }
  const rows = await prisma.warehouse.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      addressLine1: true,
      city: true,
      region: true,
      countryCode: true,
      isActive: true,
    },
  });
  return (
    <div>
      <h2 className="text-2xl font-semibold text-zinc-900">CFS & Warehouses</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Manage consolidation locations used in load planning.
      </p>
      <div className="mt-8">
        <SettingsWarehousesClient initialRows={rows} />
      </div>
    </div>
  );
}
