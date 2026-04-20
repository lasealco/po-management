import Link from "next/link";

import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { listTariffProviders } from "@/lib/tariff/providers";
import { TARIFF_CONTRACTS_DIRECTORY_PATH } from "@/lib/tariff/tariff-workbench-urls";
import { TariffProvidersDirectoryClient } from "./tariff-providers-directory-client";

export const dynamic = "force-dynamic";

export default async function TariffProvidersPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "edit"));
  const { items } = await listTariffProviders({ take: 300 });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Master data</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Tariff providers</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Carriers, NVOCCs, airlines, and forwarders referenced on contract headers. Global directory (not
              tenant-scoped) — SCAC / IATA alignment can be layered later.
            </p>
          </div>
          <Link href={TARIFF_CONTRACTS_DIRECTORY_PATH} className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline">
            Back to contracts
          </Link>
        </div>
        <div className="mt-8">
          <TariffProvidersDirectoryClient initialProviders={items} canEdit={canEdit} />
        </div>
      </section>
    </main>
  );
}
