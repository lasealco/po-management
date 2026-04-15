import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { ControlTowerDashboardManager } from "@/components/control-tower-dashboard-manager";

export const dynamic = "force-dynamic";

export default async function ControlTowerMyDashboardPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.controltower", "edit"),
  );
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <ControlTowerDashboardManager canEdit={canEdit} />
    </main>
  );
}
