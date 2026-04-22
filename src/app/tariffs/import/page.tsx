import Link from "next/link";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";
import { TariffImportParseBadge, TariffImportReviewBadge } from "@/components/tariffs/tariff-import-badges";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { listTariffImportBatchesForTenant } from "@/lib/tariff/import-batches";
import { getDemoTenant } from "@/lib/demo-tenant";
import {
  TARIFF_CHARGE_CODES_PATH,
  TARIFF_CONTRACTS_DIRECTORY_PATH,
  TARIFF_GEOGRAPHY_PATH,
  TARIFF_IMPORT_NEW_PATH,
  tariffImportBatchPath,
} from "@/lib/tariff/tariff-workbench-urls";

export const dynamic = "force-dynamic";

function fmtBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function TariffImportDirectoryPage() {
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

  const batches = await listTariffImportBatchesForTenant({ tenantId: tenant.id, take: 200 });

  return (
    <main className="mx-auto w-full max-w-7xl py-10 pl-2 pr-6 sm:pl-3 md:pl-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Tariff import center</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Step 1: upload Excel or PDF sources. Files are stored with metadata; parsing and OCR are wired later.
            </p>
          </div>
          {canEdit ? (
            <Link
              href={TARIFF_IMPORT_NEW_PATH}
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
            >
              New upload
            </Link>
          ) : null}
        </div>

        <div className="mt-8 rounded-xl border border-zinc-100 bg-zinc-50/80 p-5 text-sm text-zinc-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Rates workspace checklist</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>
              Maintain{" "}
              <Link href={TARIFF_CHARGE_CODES_PATH} className="font-medium text-[var(--arscmp-primary)] hover:underline">
                charge codes
              </Link>{" "}
              so imported lines can map to a stable taxonomy.
            </li>
            <li>
              Configure{" "}
              <Link href={TARIFF_GEOGRAPHY_PATH} className="font-medium text-[var(--arscmp-primary)] hover:underline">
                geography groups
              </Link>{" "}
              for POL/POD and inland scopes your contracts use.
            </li>
            <li>
              Publish carrier / forwarder rates under{" "}
              <Link href={TARIFF_CONTRACTS_DIRECTORY_PATH} className="font-medium text-[var(--arscmp-primary)] hover:underline">
                contracts
              </Link>
              . Import batches here feed staging until mapping and promotion are extended.
            </li>
          </ol>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">File</th>
                <th className="py-2 pr-4">Batch id</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Size</th>
                <th className="py-2 pr-4">Parse</th>
                <th className="py-2 pr-4">Review</th>
                <th className="py-2 pr-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-500">
                    No import batches yet.
                    {canEdit ? (
                      <>
                        {" "}
                        <Link href={TARIFF_IMPORT_NEW_PATH} className="font-medium text-[var(--arscmp-primary)] hover:underline">
                          Upload a file
                        </Link>
                        .
                      </>
                    ) : null}
                  </td>
                </tr>
              ) : null}
              {batches.map((b) => (
                <tr key={b.id} className="border-b border-zinc-100">
                  <td className="py-3 pr-4">
                    <Link href={tariffImportBatchPath(b.id)} className="font-medium text-[var(--arscmp-primary)] hover:underline">
                      {b.uploadedFilename ?? b.sourceReference ?? "Untitled batch"}
                    </Link>
                    {b.legalEntity ? (
                      <p className="mt-0.5 text-xs text-zinc-500">{b.legalEntity.name}</p>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <RecordIdCopy id={b.id} copyButtonLabel="Copy batch id" />
                  </td>
                  <td className="py-3 pr-4 text-zinc-700">{b.sourceType}</td>
                  <td className="py-3 pr-4 text-xs text-zinc-600">{fmtBytes(b.sourceByteSize)}</td>
                  <td className="py-3 pr-4">
                    <TariffImportParseBadge status={b.parseStatus} />
                  </td>
                  <td className="py-3 pr-4">
                    <TariffImportReviewBadge status={b.reviewStatus} />
                  </td>
                  <td className="py-3 pr-4 text-xs text-zinc-600">{b.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
