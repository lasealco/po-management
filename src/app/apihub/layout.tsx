import { Suspense } from "react";

import { ApihubGate } from "./apihub-gate";
import { ApihubHeader } from "./apihub-header";

export default function ApihubLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApihubGate>
      <div className="min-h-screen bg-zinc-50">
        <Suspense fallback={<div className="h-10 border-b border-zinc-200 bg-white" />}>
          <ApihubHeader />
        </Suspense>
        {children}
      </div>
    </ApihubGate>
  );
}
