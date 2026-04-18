import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

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
  return <>{children}</>;
}
