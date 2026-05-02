import { PoMgmtModuleSidebar } from "@/components/po-mgmt-module-sidebar";
import { ModuleWorkspaceShell } from "@/components/shell/module-sidebar-primitives";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

export async function PoMgmtWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  const { poSubNavVisibility } = await resolveNavState(access);

  return (
    <div className="min-h-screen bg-zinc-50">
      <ModuleWorkspaceShell sidebar={<PoMgmtModuleSidebar visibility={poSubNavVisibility} />}>
        {children}
      </ModuleWorkspaceShell>
    </div>
  );
}
