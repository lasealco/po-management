import { Suspense } from "react";

import { TariffsSubNav } from "@/components/tariffs/tariffs-subnav";

import { TariffsGate } from "./tariffs-gate";

export default function TariffsLayout({ children }: { children: React.ReactNode }) {
  return (
    <TariffsGate>
      <div className="min-h-screen bg-zinc-50">
        <header className="bg-white">
          <Suspense fallback={<div className="h-10" />}>
            <TariffsSubNav />
          </Suspense>
        </header>
        {children}
      </div>
    </TariffsGate>
  );
}
