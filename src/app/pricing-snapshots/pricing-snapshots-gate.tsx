import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export async function PricingSnapshotsGate({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Pricing snapshots"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }
  const g = access.grantSet;
  if (
    !viewerHas(g, "org.tariffs", "view") &&
    !viewerHas(g, "org.rfq", "view") &&
    !viewerHas(g, "org.invoice_audit", "view")
  ) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Pricing snapshots"
          message="You need org.tariffs → view, org.rfq → view, or org.invoice_audit → view (read-only snapshot access for invoice audit)."
        />
      </div>
    );
  }
  return <>{children}</>;
}
