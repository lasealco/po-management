import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { SupplierCreateForm } from "@/components/supplier-create-form";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

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

  if (!viewerHas(access.grantSet, "org.suppliers", "edit")) {
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
        <aside
          className="mt-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-700 shadow-sm"
          aria-label="SRM demo flow hint"
        >
          <p className="font-semibold text-zinc-900">Runnable demo (buyer → approver)</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              Stay as <strong>buyer@demo-company.com</strong> (or any user with{" "}
              <code className="rounded bg-zinc-100 px-1">org.suppliers → edit</code>): create the supplier
              here — you open on <strong>Onboarding</strong>.
            </li>
            <li>
              Mark checklist items <strong>done</strong> or <strong>waived</strong>; add at least one{" "}
              <strong>Document</strong> with category insurance, license, or certificate (optional expiry)
              so <strong>Compliance</strong> shows readiness.
            </li>
            <li>
              In <strong>Settings → Demo session</strong>, switch to{" "}
              <strong>approver@demo-company.com</strong> (password <code className="rounded bg-zinc-100 px-1">demo12345</code>
              ), reopen this supplier, and use <strong>Approve and activate</strong>.
            </li>
          </ol>
        </aside>
        <div className="mt-4">
          <SupplierCreateForm defaultSrmCategory={kind} />
        </div>
      </main>
    </div>
  );
}
