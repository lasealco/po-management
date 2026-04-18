import Link from "next/link";

import { serializeInvoiceChargeAlias } from "@/app/api/invoice-audit/_lib/serialize";
import { ChargeAliasesClient } from "@/components/invoice-audit/charge-aliases-client";
import { DemoSeedCopyBlock } from "@/components/invoice-audit/demo-seed-copy-block";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { listInvoiceChargeAliasesForTenant } from "@/lib/invoice-audit/invoice-charge-aliases";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export default async function InvoiceAuditChargeAliasesPage() {
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.invoice_audit", "edit"));

  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-zinc-600">Tenant not found.</p>
      </main>
    );
  }

  const rows = await listInvoiceChargeAliasesForTenant({ tenantId: tenant.id });
  const initialAliases = rows.map(serializeInvoiceChargeAlias);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/invoice-audit" className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline">
        ← Invoice intakes
      </Link>
      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Invoice audit · Configuration</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Charge aliases</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Tenant-specific dictionary entries used during <span className="font-medium">Run audit</span> ocean line
          matching. They do not replace built-in wording expansion; they let operations map recurring carrier invoice
          phrases to tokens that appear on frozen snapshot labels (rates and surcharges).
        </p>
        {!canEdit ? (
          <p className="mt-3 text-xs text-zinc-500">
            View only. Editing requires <span className="font-medium">org.invoice_audit → edit</span>.
          </p>
        ) : null}

        <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Try on a demo intake</p>
          <p className="mt-1 text-xs text-zinc-600">
            After changing aliases, open an intake and <span className="font-medium">Run audit</span> again so the
            matcher reloads the dictionary.
          </p>
          <DemoSeedCopyBlock className="mt-2" />
        </div>

        <ChargeAliasesClient canEdit={canEdit} initialAliases={initialAliases} />
      </section>
    </main>
  );
}
