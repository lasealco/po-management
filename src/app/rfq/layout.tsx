import { Suspense } from "react";

import { RfqSubNav } from "@/components/rfq/rfq-subnav";

import { RfqGate } from "./rfq-gate";

export default function RfqLayout({ children }: { children: React.ReactNode }) {
  return (
    <RfqGate>
      <div className="min-h-screen bg-zinc-50">
        <Suspense fallback={<div className="h-10 border-b border-zinc-200 bg-white" />}>
          <RfqSubNav />
        </Suspense>
        {children}
      </div>
    </RfqGate>
  );
}
