import { Suspense } from "react";

import { ControlTowerSubNavShell } from "./control-tower-subnav-shell";

import { ControlTowerGate } from "./control-tower-gate";

export default function ControlTowerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ControlTowerGate>
      <div className="min-h-screen bg-zinc-50">
        <Suspense fallback={<div className="h-10 border-b border-zinc-200 bg-white" />}>
          <ControlTowerSubNavShell />
        </Suspense>
        {children}
      </div>
    </ControlTowerGate>
  );
}
