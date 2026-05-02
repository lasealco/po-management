import { ModuleWorkspaceShell } from "@/components/shell/module-sidebar-primitives";
import { SalesOrdersModuleSidebar } from "@/components/sales-orders-module-sidebar";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

export default async function SalesOrdersLayout({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  const { linkVisibility } = await resolveNavState(access);

  return (
    <div className="min-h-screen bg-zinc-50">
      {linkVisibility?.salesOrders ? (
        <ModuleWorkspaceShell sidebar={<SalesOrdersModuleSidebar />}>{children}</ModuleWorkspaceShell>
      ) : (
        children
      )}
    </div>
  );
}
