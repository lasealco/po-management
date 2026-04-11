import { CrmOpportunitiesList } from "@/components/crm-opportunities-list";

import { CrmGate } from "../crm-gate";

export const dynamic = "force-dynamic";

export default async function CrmOpportunitiesPage() {
  return (
    <CrmGate>
      <CrmOpportunitiesList />
    </CrmGate>
  );
}
