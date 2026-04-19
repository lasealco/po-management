import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import {
  ensureInvoiceAuditSchemaReady,
  INVOICE_AUDIT_MIGRATION_SEQUENCE_HINT,
} from "@/lib/invoice-audit/invoice-audit-db-readiness";
import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";

export async function InvoiceAuditGate({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Invoice audit"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.invoice_audit", "view")) {
    return (
      <div className="px-6 py-16">
        <AccessDenied title="Invoice audit" message="You need org.invoice_audit → view permission." />
      </div>
    );
  }
  try {
    await ensureInvoiceAuditSchemaReady();
  } catch (e) {
    if (e instanceof InvoiceAuditError && e.code === "SCHEMA_NOT_READY") {
      return (
        <div className="px-6 py-16">
          <AccessDenied
            title="Invoice audit — database not ready"
            message={
              <>
                <p>{e.message}</p>
                <p className="mt-3 font-medium text-zinc-800">Unblock checklist</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                  <li>
                    Run <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">npm run db:migrate</code>{" "}
                    (or <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">prisma migrate deploy</code>
                    ) on the <span className="font-medium">same DATABASE_URL</span> this app uses ({INVOICE_AUDIT_MIGRATION_SEQUENCE_HINT}).
                  </li>
                  <li>
                    Open{" "}
                    <Link
                      href="/invoice-audit/readiness?refresh=1"
                      className="font-medium text-[var(--arscmp-primary)] hover:underline"
                    >
                      Database readiness
                    </Link>{" "}
                    to confirm tables, columns, and finished migration rows (bypasses the short server cache).
                  </li>
                  <li>
                    Deploy / Neon details: <span className="font-mono text-xs">docs/database-neon.md</span> (invoice audit section).
                  </li>
                </ol>
              </>
            }
          />
        </div>
      );
    }
    throw e;
  }
  return <>{children}</>;
}
