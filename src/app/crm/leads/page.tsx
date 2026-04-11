import { CrmLeadsList } from "@/components/crm-leads-list";

import { CrmGate } from "../crm-gate";

export const dynamic = "force-dynamic";

export default async function CrmLeadsPage() {
  return (
    <CrmGate>
      <CrmLeadsList />
    </CrmGate>
  );
}
