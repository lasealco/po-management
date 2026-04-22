import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export async function TariffsGate({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <AccessDenied
            title="Tariffs & rates"
            message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
          />
        </div>
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.tariffs", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <AccessDenied title="Tariffs & rates" message="You need org.tariffs → view permission." />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
