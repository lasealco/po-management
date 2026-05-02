import { ModuleWorkspaceShell } from "@/components/shell/module-sidebar-primitives";
import { CrmModuleSidebar } from "@/components/crm-module-sidebar";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <ModuleWorkspaceShell sidebar={<CrmModuleSidebar />}>{children}</ModuleWorkspaceShell>
    </div>
  );
}
