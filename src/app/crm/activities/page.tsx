import { CrmActivitiesHub } from "@/components/crm-activities-hub";

import { CrmGate } from "../crm-gate";

export const dynamic = "force-dynamic";

export default async function CrmActivitiesPage() {
  return (
    <CrmGate>
      <CrmActivitiesHub />
    </CrmGate>
  );
}
