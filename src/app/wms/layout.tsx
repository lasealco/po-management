import { Suspense } from "react";

import { WmsSubNav } from "@/components/wms-subnav";

import { WmsGate } from "./wms-gate";

export default function WmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <WmsGate>
      <div className="min-h-screen bg-zinc-50">
        <Suspense fallback={<div className="h-10 border-b border-zinc-200 bg-white" />}>
          <WmsSubNav />
        </Suspense>
        {children}
      </div>
    </WmsGate>
  );
}
