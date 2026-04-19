import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export async function RfqGate({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="px-6 py-16">
        <AccessDenied
          title="RFQ"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.rfq", "view")) {
    return (
      <div className="px-6 py-16">
        <AccessDenied title="RFQ" message="You need org.rfq → view permission." />
      </div>
    );
  }
  return <>{children}</>;
}
