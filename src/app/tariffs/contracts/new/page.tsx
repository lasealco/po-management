import { TariffNewContractForm } from "@/components/tariffs/tariff-new-contract-form";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TariffNewContractPage() {
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "edit"));

  if (!tenant) {
    return (
      <main className="mx-auto w-full max-w-7xl py-12 pl-2 pr-6 sm:pl-3 md:pl-6">
        <p className="text-zinc-600">Tenant not found.</p>
      </main>
    );
  }

  const [providers, legalEntities] = await Promise.all([
    prisma.tariffProvider.findMany({
      where: { status: "ACTIVE" },
      orderBy: { legalName: "asc" },
      take: 300,
      select: { id: true, legalName: true, tradingName: true },
    }),
    prisma.tariffLegalEntity.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, code: true },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl py-10 pl-2 pr-6 sm:pl-3 md:pl-6">
      <TariffNewContractForm providers={providers} legalEntities={legalEntities} canEdit={canEdit} />
    </main>
  );
}
