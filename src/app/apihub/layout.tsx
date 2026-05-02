import { Suspense } from "react";

import { ModuleWorkspaceShell } from "@/components/shell/module-sidebar-primitives";

import { ApiHubModuleSidebar } from "./api-hub-module-sidebar";
import { ApihubGate } from "./apihub-gate";

export default function ApihubLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApihubGate>
      <div className="min-h-screen bg-zinc-50">
        <ModuleWorkspaceShell
          sidebar={
            <Suspense
              fallback={<div className="h-72 w-full shrink-0 animate-pulse rounded-2xl bg-zinc-100 lg:w-56" aria-hidden />}
            >
              <ApiHubModuleSidebar />
            </Suspense>
          }
        >
          {children}
        </ModuleWorkspaceShell>
      </div>
    </ApihubGate>
  );
}
