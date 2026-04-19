import { Suspense } from "react";

import { PricingSnapshotsSubNav } from "@/components/pricing-snapshots/pricing-snapshots-subnav";

import { PricingSnapshotsGate } from "./pricing-snapshots-gate";

export default function PricingSnapshotsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PricingSnapshotsGate>
      <div className="min-h-screen bg-zinc-50">
        <Suspense fallback={<div className="h-10 border-b border-zinc-200 bg-white" />}>
          <PricingSnapshotsSubNav />
        </Suspense>
        {children}
      </div>
    </PricingSnapshotsGate>
  );
}
