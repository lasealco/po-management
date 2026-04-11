import { Suspense } from "react";

import { CrmOpportunitiesList } from "@/components/crm-opportunities-list";

import { CrmGate } from "../crm-gate";

export const dynamic = "force-dynamic";

export default async function CrmOpportunitiesPage() {
  return (
    <CrmGate>
      <Suspense fallback={<div className="px-6 py-16 text-sm text-zinc-500">Loading…</div>}>
        <CrmOpportunitiesList />
      </Suspense>
    </CrmGate>
  );
}
