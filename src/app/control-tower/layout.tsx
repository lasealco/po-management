import { Suspense } from "react";

import { ModuleWorkspaceShell } from "@/components/shell/module-sidebar-primitives";

import { ControlTowerSubNavShell } from "./control-tower-subnav-shell";

import { ControlTowerGate } from "./control-tower-gate";

export default function ControlTowerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ControlTowerGate>
      <div className="min-h-screen bg-zinc-50">
        <ModuleWorkspaceShell
          sidebar={
            <Suspense
              fallback={<div className="h-72 w-full shrink-0 animate-pulse rounded-2xl bg-zinc-100 lg:w-56" aria-hidden />}
            >
              <ControlTowerSubNavShell />
            </Suspense>
          }
        >
          {children}
        </ModuleWorkspaceShell>
      </div>
    </ControlTowerGate>
  );
}
