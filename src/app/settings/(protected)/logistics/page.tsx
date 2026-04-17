import { SettingsLogisticsClient } from "@/components/settings-logistics-client";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsLogisticsPage() {
  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <div className="py-8">
        <p className="text-zinc-600">Demo tenant not found. Run db:seed.</p>
      </div>
    );
  }

  const [locations, locationCodes] = await Promise.all([
    prisma.warehouse.findMany({
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
    }),
    prisma.locationCode.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ type: "asc" }, { code: "asc" }],
      take: 120,
      select: { id: true, type: true, code: true, name: true, countryCode: true, isActive: true, source: true },
    }),
  ]);

  return (
    <div>
      <h2 className="text-2xl font-semibold text-zinc-900">Logistics master data</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Keep buyer offices and CFS location codes here. Supplier/forwarder/carrier profiles are now
        managed in SRM.
      </p>
      <div className="mt-8">
        <SettingsLogisticsClient initialLocations={locations} initialLocationCodes={locationCodes} />
      </div>
    </div>
  );
}

