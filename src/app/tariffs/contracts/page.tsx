import Link from "next/link";

import { TARIFF_NEW_CONTRACT_PATH, tariffContractHeaderPath } from "@/lib/tariff/tariff-workbench-urls";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";
import { TariffBadge, tariffContractStatusTone } from "@/components/tariffs/tariff-badges";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { listTariffContractHeadersForTenant } from "@/lib/tariff/contract-headers";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export default async function TariffContractsDirectoryPage() {
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

  const contracts = await listTariffContractHeadersForTenant({ tenantId: tenant.id, take: 200 });

  return (
    <main className="mx-auto w-full max-w-7xl py-10 pl-2 pr-6 sm:pl-3 md:pl-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Tariff contracts</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Step 1: browse contracts for your tenant. Open a contract to manage versions and pricing lines.
            </p>
          </div>
          {canEdit ? (
            <Link
              href={TARIFF_NEW_CONTRACT_PATH}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
            >
              New contract
            </Link>
          ) : null}
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4">Mode</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Updated</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-500">
                    No contracts yet.
                    {canEdit ? (
                      <>
                        {" "}
                        <Link href={TARIFF_NEW_CONTRACT_PATH} className="font-medium text-[var(--arscmp-primary)] hover:underline">
                          Create the first contract
                        </Link>
                        .
                      </>
                    ) : null}
                  </td>
                </tr>
              ) : null}
              {contracts.map((c) => (
                <tr key={c.id} className="border-b border-zinc-100">
                  <td className="py-3 pr-4">
                    <Link href={tariffContractHeaderPath(c.id)} className="font-medium text-[var(--arscmp-primary)] hover:underline">
                      {c.title}
                    </Link>
                    {c.contractNumber ? (
                      <span className="ml-2 text-xs text-zinc-500">#{c.contractNumber}</span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <RecordIdCopy id={c.id} />
                  </td>
                  <td className="py-3 pr-4 text-zinc-700">
                    {c.provider.tradingName ?? c.provider.legalName}
                  </td>
                  <td className="py-3 pr-4 text-zinc-700">{c.transportMode}</td>
                  <td className="py-3 pr-4">
                    <TariffBadge label={c.status} tone={tariffContractStatusTone(c.status)} />
                  </td>
                  <td className="py-3 pr-4 text-xs text-zinc-500">
                    {c.updatedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
