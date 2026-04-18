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
  if (!viewerHas(g, "org.tariffs", "view") && !viewerHas(g, "org.rfq", "view")) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="Pricing snapshots"
          message="You need org.tariffs → view or org.rfq → view."
        />
      </div>
    );
  }
  return <>{children}</>;
}
