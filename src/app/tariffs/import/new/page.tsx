import Link from "next/link";

import { TariffImportUploadFormClient } from "@/components/tariffs/tariff-import-upload-form-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TariffImportNewPage() {
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

  const legalEntities = await prisma.tariffLegalEntity.findMany({
    where: { tenantId: tenant.id, status: "ACTIVE" },
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, code: true },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 text-sm text-zinc-600">
        <Link href="/tariffs/import" className="font-medium text-[var(--arscmp-primary)] hover:underline">
          Import center
        </Link>
        <span className="mx-2 text-zinc-400">/</span>
        <span className="text-zinc-900">New upload</span>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow · Step 1</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Upload tariff file</h1>
        <p className="mt-2 text-sm text-zinc-600">
          The batch record stores file URL, MIME type, size, and client metadata. No spreadsheet or PDF parsing runs in
          this build.
        </p>
        {!canEdit ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            View-only. Ask for <span className="font-medium">org.tariffs → edit</span> to upload.
          </p>
        ) : null}

        <div className="mt-8">
          <TariffImportUploadFormClient canEdit={canEdit} legalEntities={legalEntities} />
        </div>
      </section>
    </main>
  );
}
