import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { ControlTowerWorkbench } from "@/components/control-tower-workbench";

export const dynamic = "force-dynamic";

export default async function ControlTowerWorkbenchPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.controltower", "edit"),
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Tracking workbench</h1>
        <p className="mt-1 text-sm text-zinc-600">
          High-volume list with status, mode, and text search across PO numbers, tracking, carriers, and saved B/L
          references.
        </p>
      </header>
      <ControlTowerWorkbench canEdit={canEdit} />
    </main>
  );
}
