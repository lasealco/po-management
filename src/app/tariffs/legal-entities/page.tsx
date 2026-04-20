import Link from "next/link";

import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { listTariffLegalEntitiesForTenant } from "@/lib/tariff/legal-entities";
import { getDemoTenant } from "@/lib/demo-tenant";
import { TARIFF_CONTRACTS_DIRECTORY_PATH } from "@/lib/tariff/tariff-workbench-urls";
import { TariffLegalEntitiesDirectoryClient } from "./tariff-legal-entities-directory-client";

export const dynamic = "force-dynamic";

export default async function TariffLegalEntitiesPage() {
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "edit"));

  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-zinc-600">Tenant not found.</p>
      </main>
    );
  }

  const { items } = await listTariffLegalEntitiesForTenant({ tenantId: tenant.id, take: 300 });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Master data</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Legal entities</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Contracting parties on your side of tariff agreements (tenant-scoped). Attach to contract headers and
              import batches as the model hardens.
            </p>
          </div>
          <Link href={TARIFF_CONTRACTS_DIRECTORY_PATH} className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline">
            Back to contracts
          </Link>
        </div>
        <div className="mt-8">
          <TariffLegalEntitiesDirectoryClient initialRows={items} canEdit={canEdit} />
        </div>
      </section>
    </main>
  );
}
