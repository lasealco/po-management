import Link from "next/link";

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

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/invoice-audit" className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline">
        ← Invoice intakes
      </Link>
      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Invoice audit</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Tolerance rules</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Audits use the highest-priority <span className="font-medium">active</span> rule for the intake currency (or a
          global rule with no currency scope). Defaults are also applied when no rule matches.
        </p>
        {canEdit ? (
          <p className="mt-3 text-xs text-zinc-500">
            Create or adjust rules via <code className="rounded bg-zinc-100 px-1">POST /api/invoice-audit/tolerance-rules</code>{" "}
            (UI editor not in scope for this pass).
          </p>
        ) : null}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Priority</th>
                <th className="py-2 pr-4">Active</th>
                <th className="py-2 pr-4">Currency scope</th>
                <th className="py-2 pr-4">Abs Δ</th>
                <th className="py-2 pr-4">Percent</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-zinc-500">
                    No rules yet. Run <code className="rounded bg-zinc-100 px-1">npm run db:seed</code> for the demo
                    default rule, or create one via the API.
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100">
                    <td className="py-3 pr-4 font-medium text-zinc-900">{r.name}</td>
                    <td className="py-3 pr-4 tabular-nums text-zinc-700">{r.priority}</td>
                    <td className="py-3 pr-4 text-zinc-700">{r.active ? "Yes" : "No"}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-zinc-600">{r.currencyScope ?? "— (any)"}</td>
                    <td className="py-3 pr-4 tabular-nums text-zinc-700">{r.amountAbsTolerance?.toString() ?? "—"}</td>
                    <td className="py-3 pr-4 tabular-nums text-zinc-700">{r.percentTolerance?.toString() ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
