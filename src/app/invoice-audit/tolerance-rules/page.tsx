import Link from "next/link";

import { DemoSeedCopyBlock } from "@/components/invoice-audit/demo-seed-copy-block";
import { serializeToleranceRule } from "@/app/api/invoice-audit/_lib/serialize";
import { ToleranceRulesClient } from "@/components/invoice-audit/tolerance-rules-client";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { listToleranceRulesForTenant } from "@/lib/invoice-audit/tolerance-rules";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export default async function InvoiceAuditToleranceRulesPage() {
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

  const rules = await listToleranceRulesForTenant({ tenantId: tenant.id });
  const initialRules = rules.map(serializeToleranceRule);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/invoice-audit" className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline">
        ← Invoice intakes
      </Link>
      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Invoice audit · Configuration</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Tolerance rules</h1>
        <p className="mt-2 text-sm text-zinc-600">
          When someone runs <span className="font-medium">Run audit</span> on an intake, the engine picks the
          highest-priority <span className="font-medium">active</span> rule for that intake&apos;s currency (or a global
          rule with no currency scope). Built-in defaults apply when nothing matches. Tolerance only affects how line
          amounts compare to the snapshot (e.g. GREEN vs AMBER) — it does <span className="font-medium">not</span>{" "}
          replace Step 2 finance review or Step 3 accounting handoff on the intake.
        </p>
        {!canEdit ? (
          <p className="mt-3 text-xs text-zinc-500">You have view access only; create and activate rules require edit permission.</p>
        ) : null}

        <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Try changes on a demo intake</p>
          <p className="mt-1 text-xs text-zinc-600">
            Tolerance bands only apply when you <span className="font-medium">Run audit</span>. Re-seed a known-good
            intake, tweak rules, then re-open the intake and run audit again.
          </p>
          <DemoSeedCopyBlock className="mt-2" />
          <p className="mt-2 text-xs text-zinc-600">
            <Link href="/invoice-audit" className="font-medium text-[var(--arscmp-primary)] hover:underline">
              Back to intakes
            </Link>
          </p>
        </div>

        <ToleranceRulesClient canEdit={canEdit} initialRules={initialRules} />
      </section>
    </main>
  );
}
