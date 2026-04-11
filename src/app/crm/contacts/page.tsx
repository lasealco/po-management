import { CrmContactsList } from "@/components/crm-contacts-list";

import { CrmGate } from "../crm-gate";

export const dynamic = "force-dynamic";

export default async function CrmContactsPage() {
  return (
    <CrmGate>
      <CrmContactsList />
    </CrmGate>
  );
}
