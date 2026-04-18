import Link from "next/link";

import {
  checkInvoiceAuditDatabaseSchema,
  INVOICE_AUDIT_MIGRATION_SEQUENCE_HINT,
} from "@/lib/invoice-audit/invoice-audit-db-readiness";

export const dynamic = "force-dynamic";

export default async function InvoiceAuditReadinessPage(props: {
  searchParams?: Promise<{ refresh?: string | string[] }>;
}) {
  const sp = (await (props.searchParams ?? Promise.resolve({}))) as { refresh?: string | string[] };
  const refreshRaw = sp.refresh;
  const refresh =
    refreshRaw === "1" ||
    refreshRaw === "true" ||
    (Array.isArray(refreshRaw) && (refreshRaw.includes("1") || refreshRaw.includes("true")));
  const check = await checkInvoiceAuditDatabaseSchema({ bypassCache: refresh });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/invoice-audit" className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline">
        ← Invoice intakes
      </Link>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Invoice audit</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Database readiness</h1>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
          <span className="font-semibold">Typical blockers:</span> missing invoice-audit tables/columns on this
          database, or the three Phase 06 Prisma migrations not recorded as finished in{" "}
          <span className="font-mono">_prisma_migrations</span> (Preview vs Production use different{" "}
          <span className="font-mono">DATABASE_URL</span>
          —migrate the URL that matches this environment).
        </p>
        <p className="mt-3 text-sm text-zinc-600">
          Verifies Postgres <span className="font-mono text-xs">information_schema</span> for invoice-audit tables and
          columns, and finished rows in <span className="font-mono text-xs">_prisma_migrations</span> for the three
          Phase 06 folders (same payload as{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">GET /api/invoice-audit/readiness</code>
          ). Use this before a demo if intakes or audit actions fail with a schema message.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          After <span className="font-mono">migrate deploy</span>,{" "}
          <Link href="/invoice-audit/readiness?refresh=1" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            refresh this check
          </Link>{" "}
          (bypasses the short server cache).
        </p>

        <div
          className={`mt-5 rounded-xl border px-4 py-3 text-sm ${
            check.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          <p className="font-semibold">{check.ok ? "Ready" : "Not ready"}</p>
          {!check.ok && check.issues.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {check.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>

        {check.migrationHistoryNote ? (
          <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            {check.migrationHistoryNote}
          </p>
        ) : null}

        {check.appliedPrismaMigrations && check.appliedPrismaMigrations.length > 0 ? (
          <p className="mt-4 text-xs text-zinc-600">
            <span className="font-semibold text-zinc-800">Prisma migrations seen:</span>{" "}
            <span className="font-mono text-[11px]">{check.appliedPrismaMigrations.join(", ")}</span>
          </p>
        ) : null}

        <p className="mt-5 text-xs leading-relaxed text-zinc-600">
          <span className="font-semibold text-zinc-800">Expected migrations:</span>{" "}
          <span className="font-mono text-[11px] text-zinc-700">{INVOICE_AUDIT_MIGRATION_SEQUENCE_HINT}</span>
        </p>
        <p className="mt-3 text-xs text-zinc-600">
          Apply on the same database as <span className="font-mono">DATABASE_URL</span> (e.g.{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">npm run db:migrate</code> locally,{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">prisma migrate deploy</code> in CI).
        </p>
      </section>
    </main>
  );
}
