import { Suspense } from "react";

import { InvoiceAuditSubNav } from "@/components/invoice-audit/invoice-audit-subnav";

import { InvoiceAuditGate } from "./invoice-audit-gate";

export default function InvoiceAuditLayout({ children }: { children: React.ReactNode }) {
  return (
    <InvoiceAuditGate>
      <div className="min-h-screen bg-zinc-50">
        <Suspense fallback={<div className="h-10 border-b border-zinc-200 bg-white" />}>
          <InvoiceAuditSubNav />
        </Suspense>
        {children}
      </div>
    </InvoiceAuditGate>
  );
}
