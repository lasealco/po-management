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
            message={`${e.message} For CI/Vercel: run prisma migrate deploy (see ${INVOICE_AUDIT_MIGRATION_SEQUENCE_HINT}).`}
          />
        </div>
      );
    }
    throw e;
  }
  return <>{children}</>;
}
