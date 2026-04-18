import Link from "next/link";
import { notFound } from "next/navigation";

import { TariffContractHeaderClient } from "@/components/tariffs/tariff-contract-header-client";
import { TariffBadge, tariffApprovalTone, tariffContractStatusTone } from "@/components/tariffs/tariff-badges";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getTariffContractHeaderForTenant } from "@/lib/tariff/contract-headers";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default async function TariffContractDetailPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
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

  let contract;
  try {
    contract = await getTariffContractHeaderForTenant({ tenantId: tenant.id, id: contractId });
  } catch {
    notFound();
  }

  const providerLabel = contract.provider.tradingName ?? contract.provider.legalName;

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Summary</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{contract.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <TariffBadge label={contract.status} tone={tariffContractStatusTone(contract.status)} />
              <TariffBadge label={contract.transportMode} tone="neutral" />
            </div>
          </div>
          <Link
            href="/tariffs/contracts"
            className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
          >
            ← Directory
          </Link>
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Provider</dt>
            <dd className="font-medium text-zinc-900">{providerLabel}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Legal entity</dt>
            <dd className="font-medium text-zinc-900">{contract.legalEntity?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Contract number</dt>
            <dd className="font-medium text-zinc-900">{contract.contractNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Trade scope</dt>
            <dd className="text-zinc-800">{contract.tradeScope ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <TariffContractHeaderClient
        key={contract.updatedAt.toISOString()}
        contractId={contract.id}
        canEdit={canEdit}
        initialTitle={contract.title}
        initialContractNumber={contract.contractNumber}
        initialStatus={contract.status}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Versions</h2>
        <p className="mt-1 text-sm text-zinc-600">Open a version to edit lines. Approved versions are read-only.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">#</th>
                <th className="py-2 pr-4">Approval</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Valid from</th>
                <th className="py-2 pr-4">Valid to</th>
                <th className="py-2 pr-4">Source</th>
              </tr>
            </thead>
            <tbody>
              {contract.versions.map((v) => {
                const frozen = v.approvalStatus === "APPROVED" && v.status === "APPROVED";
                return (
                  <tr key={v.id} className="border-b border-zinc-100">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/tariffs/contracts/${contract.id}/versions/${v.id}`}
                        className="font-medium text-[var(--arscmp-primary)] hover:underline"
                      >
                        v{v.versionNo}
                      </Link>
                      {frozen ? (
                        <span className="ml-2 text-xs font-medium text-emerald-700">Frozen</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4">
                      <TariffBadge label={v.approvalStatus} tone={tariffApprovalTone(v.approvalStatus)} />
                    </td>
                    <td className="py-3 pr-4">
                      <TariffBadge label={v.status} tone={tariffContractStatusTone(v.status)} />
                    </td>
                    <td className="py-3 pr-4 text-zinc-700">{fmtDate(v.validFrom)}</td>
                    <td className="py-3 pr-4 text-zinc-700">{fmtDate(v.validTo)}</td>
                    <td className="py-3 pr-4 text-zinc-600">{v.sourceType}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
