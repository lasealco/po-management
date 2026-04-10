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

  const [locations, suppliers] = await Promise.all([
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
    prisma.supplier.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        email: true,
        phone: true,
        offices: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
            countryCode: true,
            isActive: true,
          },
        },
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            phone: true,
            isPrimary: true,
          },
        },
      },
    }),
  ]);

  return (
    <div>
      <h2 className="text-2xl font-semibold text-zinc-900">Logistics master data</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Centralize buyer offices, CFS locations, and forwarder offices/contacts used by the order
        create workflow.
      </p>
      <div className="mt-8">
        <SettingsLogisticsClient initialLocations={locations} initialForwarders={suppliers} />
      </div>
    </div>
  );
}

