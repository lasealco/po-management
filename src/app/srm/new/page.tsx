import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { SupplierCreateForm } from "@/components/supplier-create-form";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveSrmPermissions } from "@/lib/srm/permissions";

export const dynamic = "force-dynamic";

function parseKind(raw: string | string[] | undefined): "product" | "logistics" {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "logistics" ? "logistics" : "product";
}

export default async function SrmNewSupplierPage({
  searchParams,
}: {
  searchParams?: Promise<{ kind?: string | string[] }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const kind = parseKind(sp.kind);
  const access = await getViewerGrantSet();

  if (!access || !access.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Create partner"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }

  const permissions = resolveSrmPermissions(access.grantSet);

  if (!permissions.canEditSuppliers) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Create partner"
          message="You do not have permission to create supplier master data (org.suppliers → edit)."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm">
          <Link href={`/srm?kind=${kind}`} className="font-medium text-[var(--arscmp-primary)] hover:underline">
            ← Back to SRM {kind === "logistics" ? "logistics" : "product"} partners
          </Link>
        </p>
        <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <SupplierCreateForm defaultSrmCategory={kind} inPageShell />
        </section>
      </main>
    </div>
  );
}
