import { CrmAccountsList } from "@/components/crm-accounts-list";

import { CrmGate } from "../crm-gate";

export const dynamic = "force-dynamic";

export default async function CrmAccountsPage() {
  return (
    <CrmGate>
      <CrmAccountsList />
    </CrmGate>
  );
}
