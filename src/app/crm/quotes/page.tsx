import { CrmQuotesList } from "@/components/crm-quotes-list";

import { CrmGate } from "../crm-gate";

export const dynamic = "force-dynamic";

export default async function CrmQuotesPage() {
  return (
    <CrmGate>
      <CrmQuotesList />
    </CrmGate>
  );
}
