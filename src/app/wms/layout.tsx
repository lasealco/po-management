import { Suspense } from "react";

import { ModuleWorkspaceShell } from "@/components/shell/module-sidebar-primitives";
import { WmsModuleSidebar } from "@/components/wms-module-sidebar";

import { WmsGate } from "./wms-gate";

export default function WmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <WmsGate>
      <div className="min-h-screen bg-zinc-50">
        <ModuleWorkspaceShell
          sidebar={
            <Suspense
              fallback={<div className="h-72 w-full shrink-0 animate-pulse rounded-2xl bg-zinc-100 lg:w-56" aria-hidden />}
            >
              <WmsModuleSidebar />
            </Suspense>
          }
        >
          {children}
        </ModuleWorkspaceShell>
      </div>
    </WmsGate>
  );
}
